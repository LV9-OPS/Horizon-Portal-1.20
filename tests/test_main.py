from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


def test_v1_status_and_update_contract():
    status = client.get("/api/v1/status")
    assert status.status_code == 200
    assert status.json()["version"] == "0.9.10"

    update = client.get("/api/v1/updates/manager")
    assert update.status_code == 200
    body = update.json()
    assert body["product"] == "Horizon Manager"
    assert body["platform"] == "windows-x64"


def test_v1_workshop_etag():
    first = client.get("/api/v1/workshop")
    assert first.status_code == 200
    etag = first.headers.get("etag")
    assert etag
    second = client.get("/api/v1/workshop", headers={"If-None-Match": etag})
    assert second.status_code == 304


def test_cross_origin_state_change_is_blocked():
    response = client.post(
        "/api/launcher/redeem",
        json={"code": "invalid", "installation_id": "invalid"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
