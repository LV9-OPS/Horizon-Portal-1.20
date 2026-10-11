use serde::Serialize;
use std::{
    collections::HashSet,
    env,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{mpsc::{self, Sender}, Mutex, OnceLock},
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::Duration,
};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use tauri::{Emitter, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Debug, Clone, Serialize)]
struct LocalProject {
    id: String,
    name: String,
    kind: String,
    executable: String,
    directory: String,
    source: String,
}

fn ignored_directory(path: &Path) -> bool {
    let value = path.to_string_lossy().to_lowercase();
    [
        "\\windows\\",
        "\\appdata\\local\\microsoft\\",
        "\\appdata\\local\\packages\\",
        "\\node_modules\\",
        "\\.git\\",
        "\\target\\",
    ]
    .iter()
    .any(|part| value.contains(part))
}

const DISCORD_APPLICATION_ID: &str = "1552918617417322546";
static PRESENCE_TX: OnceLock<Mutex<Option<Sender<PresenceCommand>>>> = OnceLock::new();
static PRESENCE_GENERATION: AtomicU64 = AtomicU64::new(0);

enum PresenceCommand {
    Set { game: String },
    Clear,
}

fn presence_sender() -> Sender<PresenceCommand> {
    let lock = PRESENCE_TX.get_or_init(|| Mutex::new(None));
    let mut guard = lock.lock().expect("Discord presence mutex poisoned");
    if let Some(sender) = guard.as_ref() {
        return sender.clone();
    }

    let (tx, rx) = mpsc::channel::<PresenceCommand>();
    thread::spawn(move || {
        let mut client: Option<DiscordIpcClient> = None;

        loop {
            match rx.recv_timeout(Duration::from_secs(15)) {
                Ok(PresenceCommand::Set { game }) => {
                    if client.is_none() {
                        let candidate = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
                        if let Ok(mut candidate) = candidate {
                            if candidate.connect().is_ok() {
                                client = Some(candidate);
                            }
                        }
                    }

                    if let Some(rpc) = client.as_mut() {
                        let details = format!("Playing {game}");
                        let result = rpc.set_activity(
                            activity::Activity::new()
                                .details(details.as_str())
                                .state("Horizon Manager")
                                .buttons(vec![activity::Button::new("Horizon Portal", "https://www.horizon-portal.xyz")]),
                        );
                        if result.is_err() {
                            let _ = rpc.close();
                            client = None;
                        }
                    }
                }
                Ok(PresenceCommand::Clear) => {
                    if let Some(rpc) = client.as_mut() {
                        let _ = rpc.clear_activity();
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if client.is_none() {
                        let candidate = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
                        if let Ok(mut candidate) = candidate {
                            if candidate.connect().is_ok() {
                                client = Some(candidate);
                            }
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    *guard = Some(tx.clone());
    tx
}

fn set_discord_presence(game: impl Into<String>) {
    let _ = presence_sender().send(PresenceCommand::Set { game: game.into() });
}

fn clear_discord_presence() {
    if let Some(lock) = PRESENCE_TX.get() {
        if let Some(sender) = lock.lock().ok().and_then(|guard| guard.as_ref().cloned()) {
            let _ = sender.send(PresenceCommand::Clear);
        }
    }
}

fn project_kind(name: &str) -> Option<(&'static str, &'static str)> {
    let lower = name.to_lowercase();
    match lower.as_str() {
        "destiny2.exe" | "destiny2" => Some(("destiny2", "Destiny 2")),
        "sunrise.exe" | "sunrise" => Some(("sunrise", "SunRise")),
        "dawn.exe" | "dawn" => Some(("dawn", "Dawn")),
        _ => None,
    }
}

fn scan_directory(root: &Path, depth: usize, seen: &mut HashSet<String>, results: &mut Vec<LocalProject>) {
    if depth > 5 || !root.is_dir() || ignored_directory(root) {
        return;
    }

    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if ignored_directory(&path) {
                continue;
            }
            scan_directory(&path, depth + 1, seen, results);
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|v| v.to_str()) else {
            continue;
        };
        let Some((id, display_name)) = project_kind(file_name) else {
            continue;
        };

        let key = path.to_string_lossy().to_lowercase();
        if !seen.insert(key) {
            continue;
        }

        let directory = path
            .parent()
            .unwrap_or(root)
            .to_string_lossy()
            .to_string();

        results.push(LocalProject {
            id: id.to_string(),
            name: display_name.to_string(),
            kind: id.to_string(),
            executable: path.to_string_lossy().to_string(),
            directory,
            source: "automatic-scan".to_string(),
        });
    }
}

#[tauri::command]
fn scan_local_projects() -> Vec<LocalProject> {
    let mut roots = Vec::<PathBuf>::new();

    if let Ok(user_profile) = env::var("USERPROFILE") {
        let user = PathBuf::from(user_profile);
        roots.extend([
            user.join("Desktop"),
            user.join("Documents"),
            user.join("Downloads"),
            user.join("Games"),
        ]);
    }

    // Common Windows game-library locations. We scan these directly so
    // Steam libraries can be found without crawling the whole drive.
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:", letter as char);
        roots.extend([
            PathBuf::from(format!("{}\\SteamLibrary\\steamapps\\common", drive)),
            PathBuf::from(format!("{}\\Steam\\steamapps\\common", drive)),
            PathBuf::from(format!("{}\\steam\\steamapps\\common", drive)),
            PathBuf::from(format!("{}\\Program Files\\Steam\\steamapps\\common", drive)),
            PathBuf::from(format!("{}\\Program Files (x86)\\Steam\\steamapps\\common", drive)),
            PathBuf::from(format!("{}\\Games", drive)),
            PathBuf::from(format!("{}\\D2", drive)),
            PathBuf::from(format!("{}\\Destiny 2", drive)),
            PathBuf::from(format!("{}\\Sun Rise", drive)),
            PathBuf::from(format!("{}\\dawn", drive)),
        ]);
    }

    for letter in b'C'..=b'Z' {
        let root = PathBuf::from(format!("{}:\\", letter as char));
        if !root.exists() {
            continue;
        }

        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_lowercase();

            let relevant = [
                "d2", "destiny", "sunrise", "sun rise", "dawn",
                "games", "game", "workshop", "mod", "project"
            ]
            .iter()
            .any(|keyword| name.contains(keyword));

            if relevant && path.is_dir() {
                roots.push(path);
            }
        }
    }

    let mut seen = HashSet::new();
    let mut results = Vec::new();

    for root in roots {
        scan_directory(&root, 0, &mut seen, &mut results);
    }

    results.sort_by(|a, b| a.name.cmp(&b.name).then(a.executable.cmp(&b.executable)));

    let mut unique = Vec::new();
    let mut kinds = HashSet::new();
    for project in results {
        if kinds.insert(project.id.clone()) {
            unique.push(project);
        }
    }
    unique
}

#[tauri::command]
fn launch_project(executable: String) -> Result<(), String> {
    let path = PathBuf::from(&executable);
    if !path.is_file() {
        return Err("Executable not found.".to_string());
    }

    let file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !matches!(
        file_name.as_str(),
        "destiny2.exe" | "destiny2" | "sunrise.exe" | "sunrise" | "dawn.exe" | "dawn"
    ) {
        return Err("This file is not a recognized Horizon game executable.".to_string());
    }

    let game_name = project_kind(&file_name)
        .map(|(_, name)| name.to_string())
        .unwrap_or_else(|| "Game".to_string());

    let generation = PRESENCE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let mut child = Command::new(&path)
        .current_dir(path.parent().unwrap_or(Path::new(".")))
        .spawn()
        .map_err(|error| format!("Unable to start project: {error}"))?;

    set_discord_presence(game_name);

    thread::spawn(move || {
        let _ = child.wait();
        if PRESENCE_GENERATION.load(Ordering::SeqCst) == generation {
            clear_discord_presence();
        }
    });

    Ok(())
}

#[tauri::command]
fn open_project_folder(path: String) -> Result<(), String> {
    let folder = PathBuf::from(path);
    if !folder.is_dir() {
        return Err("Project folder not found.".to_string());
    }

    Command::new("explorer.exe")
        .arg(folder)
        .spawn()
        .map_err(|error| format!("Unable to open folder: {error}"))?;

    Ok(())
}

#[tauri::command]
fn get_diagnostics() -> serde_json::Value {
    serde_json::json!({
        "platform": env::consts::OS,
        "architecture": env::consts::ARCH,
        "manager": "1.0.0",
        "protocol": "horizon-v1-bearer",
        "launcher": "manual-selection"
    })
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    set_discord_presence("Using Horizon Manager");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            for arg in argv.iter().skip(1) {
                if arg.starts_with("horizon://") {
                    let _ = app.emit("horizon-deep-link", arg.clone());
                }
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_local_projects,
            launch_project,
            open_project_folder,
            get_diagnostics,
            window_minimize,
            window_toggle_maximize,
            window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
