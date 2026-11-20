"""Render Check node for public media URLs; never generates media."""
import json
import ssl
import urllib.request

ENDPOINT = 'https://voopa-render-check.onrender.com/mcp'

def call_tool(name, arguments):
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}}).encode()
    req = urllib.request.Request(ENDPOINT, data=payload, method='POST', headers={'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=90, context=context) as response:
        body = response.read(1048576).decode('utf-8')
    if body.startswith('event:') or body.startswith('data:'):
        lines = [line[5:].strip() for line in body.splitlines() if line.startswith('data:')]
        body = chr(10).join(lines)
    data = json.loads(body)
    if 'error' in data:
        raise RuntimeError('Render Check error: ' + str(data['error']))
    result = data['result']
    if result.get('isError'):
        raise RuntimeError('Render Check failed: ' + json.dumps(result.get('content', [])))
    return result.get('structuredContent', result)

class RenderCheckURL:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'media_url': ('STRING', {'default': '', 'multiline': False}), 'media_type': (['video', 'image'],)}}
    RETURN_TYPES = ('STRING', 'STRING')
    RETURN_NAMES = ('media_url', 'review_json')
    OUTPUT_NODE = True
    FUNCTION = 'check'
    CATEGORY = 'VOOPA/Render Check'
    DESCRIPTION = 'Checks a publicly reachable image or video URL. Reports evidence for review; does not generate or approve a retry.'

    def check(self, media_url, media_type):
        if not media_url.startswith('https://'):
            raise ValueError('Provide a direct public HTTPS media URL. Local ComfyUI files are not uploaded by this node.')
        if media_type == 'video':
            result = call_tool('check_black_gaps', {'renderVideoUrl': media_url})
        elif media_type == 'image':
            result = call_tool('check_image_export', {'renderImageUrl': media_url, 'minWidth': 1})
        else:
            raise ValueError('Unsupported media type')
        report = json.dumps(result, ensure_ascii=False, indent=2)
        return {'ui': {'text': [report]}, 'result': (media_url, report)}

NODE_CLASS_MAPPINGS = {'VOOPARenderCheckURL': RenderCheckURL}
NODE_DISPLAY_NAME_MAPPINGS = {'VOOPARenderCheckURL': 'Render Check (public media URL)'}
