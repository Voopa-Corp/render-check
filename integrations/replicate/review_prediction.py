#!/usr/bin/env python3
"""Review a completed Replicate prediction supplied on stdin; never starts a prediction."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

module_path = Path(__file__).resolve().parents[1] / 'comfyui_render_check' / '__init__.py'
spec = importlib.util.spec_from_file_location('voopa_render_check', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def extract_urls(value):
    if isinstance(value, str):
        return [value] if value.startswith('https://') else []
    if isinstance(value, list):
        return [url for item in value for url in extract_urls(item)]
    return []

def review_prediction(prediction, media_type):
    if prediction.get('status') != 'succeeded':
        raise ValueError('Prediction must be completed with status succeeded; no review performed.')
    urls = extract_urls(prediction.get('output'))
    if not urls:
        raise ValueError('No direct HTTPS output in prediction. Object-shaped outputs must be extracted by the caller.')
    if len(urls) > 10:
        raise ValueError('Maximum 10 outputs per invocation; select the outputs to review.')
    node = module.RenderCheckURL()
    return [{'url': url, 'review': json.loads(node.check(url, media_type)['result'][1])} for url in urls]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--type', choices=['image', 'video'], required=True)
    args = parser.parse_args()
    try:
        prediction = json.load(sys.stdin)
        print(json.dumps(review_prediction(prediction, args.type), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print('Review failed: ' + str(exc), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
