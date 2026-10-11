# Horizon Manager V1.0.0

Windows Tauri launcher for Horizon Portal V1.

## V1 protocol

- Installation identity: UUID stored locally.
- Redeem: POST /api/launcher/redeem with installation_id.
- Authentication: server-issued installation credential.
- State: GET /api/launcher/state with Authorization: Bearer.
- First Light theme access: redeem a one-time HZN-FIRST-<26-character-code>.
- Workshop votes: one changeable 1–5 star rating per installation and published item.
- The installation credential is persisted locally and is never sent in the URL.

## Local development

The V1 test build defaults to:

http://127.0.0.1:8000

The API can be overridden before launch with localStorage key horizon-api.

## Build

npm install
npm run tauri build

Installer output:

src-tauri/target/release/bundle/nsis/Horizon Manager_1.0.0_x64-setup.exe
