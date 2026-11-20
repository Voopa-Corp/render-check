#!/usr/bin/env python3
"""Review completed Runware or Luma outputs. Never starts a generation."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

CLIENT = Path(__file__).resolve().parent / 'comfyui_render_check' / '__init__.py'
spec = importlib.util.spec_from_file_location('render_check_client', CLIENT)
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)

def outputs(provider, payload):
    if not isinstance(payload, dict) and not (provider == 'runware' and isinstance(payload, list)):
        raise ValueError('Expected an object response')
    if provider == 'luma':
        if payload.get('state') != 'completed':
            raise ValueError('Luma generation is not completed')
        media = payload.get('assets') or {}
        typ = 'video' if isinstance(media, dict) and media.get('video') else 'image'
        url = media.get(typ) if isinstance(media, dict) else None
        if not isinstance(url, str) or not url.startswith('https://'):
            raise ValueError('Completed Luma response has no direct HTTPS image or video URL')
        return [(typ, url)]
    if provider == 'leonardo':
        generation = payload.get('generations_by_pk')
        if not isinstance(generation, dict) or generation.get('status') != 'COMPLETE':
            raise ValueError('Leonardo generation is not complete')
        rows = generation.get('generated_images')
        if not isinstance(rows, list) or not 1 <= len(rows) <= 10:
            raise ValueError('Expected 1–10 Leonardo outputs')
        results = []
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError('Invalid Leonardo output')
            typ = 'video' if row.get('motionMP4URL') else 'image'
            url = row.get('motionMP4URL') if typ == 'video' else row.get('url')
            if not isinstance(url, str) or not url.startswith('https://'):
                raise ValueError('Leonardo output has no direct HTTPS URL')
            results.append((typ, url))
        return results
    if provider == 'bfl':
        result = payload.get('result')
        if payload.get('status') != 'Ready' or not isinstance(result, dict):
            raise ValueError('BFL result is not ready')
        url = result.get('sample')
        if not isinstance(url, str) or not url.startswith('https://'):
            raise ValueError('BFL result has no direct HTTPS image URL')
        return [('image', url)]
    if provider == 'runway':
        urls = payload.get('output')
        if payload.get('status') != 'SUCCEEDED' or not isinstance(urls, list) or not 1 <= len(urls) <= 10:
            raise ValueError('Runway video task must succeed with 1–10 outputs')
        if any(not isinstance(url, str) or not url.startswith('https://') for url in urls):
            raise ValueError('Runway outputs must be direct HTTPS URLs')
        return [('video', url) for url in urls]
    if provider == 'runware':
        rows = payload if isinstance(payload, list) else payload.get('data')
        if not isinstance(rows, list):
            raise ValueError('Runware response must include a data array')
        results = []
        for row in rows:
            if not isinstance(row, dict) or row.get('status') not in (None, 'success'):
                continue
            if row.get('taskType') == 'videoInference':
                typ, url = 'video', row.get('videoURL')
            elif row.get('taskType') == 'imageInference':
                typ, url = 'image', row.get('imageURL')
            else:
                continue
            if isinstance(url, str) and url.startswith('https://'):
                results.append((typ, url))
        if not results or len(results) > 10:
            raise ValueError('Expected 1–10 completed image or video URLs')
        return results
    raise ValueError('Unsupported provider')

def review(provider, payload):
    node = client.RenderCheckURL()
    return [{'media_type': typ, 'url': url, 'review': json.loads(node.check(url, typ)['result'][1])} for typ, url in outputs(provider, payload)]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--provider', required=True, choices=['luma', 'runware', 'leonardo', 'bfl', 'runway'])
    args = parser.parse_args()
    try:
        print(json.dumps(review(args.provider, json.load(sys.stdin)), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, RuntimeError) as exc:
        print('Review failed: ' + str(exc), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
