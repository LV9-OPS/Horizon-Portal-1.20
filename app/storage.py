import os
from pathlib import Path
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException


def configured() -> bool:
    return all(os.getenv(name, "").strip() for name in (
        "S3_ENDPOINT_URL", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
        "S3_QUARANTINE_BUCKET", "S3_PUBLIC_BUCKET", "WORKSHOP_PUBLIC_BASE_URL"
    ))


def _client():
    if not configured():
        raise HTTPException(status_code=503, detail="Persistent Workshop storage is not configured.")
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"].strip(),
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"].strip(),
        region_name=os.getenv("S3_REGION", "auto").strip(),
    )


def upload_quarantine(path: Path, object_key: str) -> str:
    client = _client()
    try:
        client.upload_file(str(path), os.environ["S3_QUARANTINE_BUCKET"].strip(), object_key, ExtraArgs={"ContentType": "application/zip"})
        return object_key
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=503, detail="Workshop quarantine storage is temporarily unavailable.")


def publish_quarantine(object_key: str, public_key: str) -> str:
    client = _client()
    private_bucket = os.environ["S3_QUARANTINE_BUCKET"].strip()
    public_bucket = os.environ["S3_PUBLIC_BUCKET"].strip()
    try:
        client.copy_object(
            Bucket=public_bucket,
            Key=public_key,
            CopySource={"Bucket": private_bucket, "Key": object_key},
            ContentType="application/zip",
            MetadataDirective="REPLACE",
        )
        return public_url(public_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=503, detail="Workshop publication storage is temporarily unavailable.")


def delete_quarantine(object_key: str) -> None:
    client = _client()
    try:
        client.delete_object(Bucket=os.environ["S3_QUARANTINE_BUCKET"].strip(), Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=503, detail="Workshop quarantine cleanup is temporarily unavailable.")


def public_url(public_key: str) -> str:
    return os.environ["WORKSHOP_PUBLIC_BASE_URL"].rstrip("/") + "/" + public_key.lstrip("/")
