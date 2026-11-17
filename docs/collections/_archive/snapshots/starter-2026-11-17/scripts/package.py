"""将已离线校验的数据打包，跳过临时缓存与拒收图片；不覆盖已有压缩包。"""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser=argparse.ArgumentParser()
parser.add_argument('output',help='新ZIP文件的保存路径')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
output=Path(args.output).resolve()
if output.exists():
    raise FileExistsError('保留已有压缩包，请更换输出路径：'+str(output))
if not (root/'catalog.json').exists() or not (root/'版本浏览清单.md').exists():
    raise RuntimeError('先采集、运行 verify.py 并生成浏览清单。')
excluded={'.venv','__pycache__','.cache','rejected-downloads'}
output.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(output,'x',ZIP_DEFLATED) as zf:
    for path in sorted(root.rglob('*')):
        relative=path.relative_to(root)
        if path.is_file() and not any(part in excluded for part in relative.parts):
            zf.write(path,arcname=str(Path(root.name)/relative))
with ZipFile(output) as zf:
    assert zf.testzip() is None
    count=len(zf.infolist())
print(f'ZIP verified: {output}; {count} files; {output.stat().st_size} bytes')
