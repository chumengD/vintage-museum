"""打包此快照，跳过缓存；目标ZIP存在时拒绝覆盖。请先运行verify.py。"""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('output')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = Path(args.output).resolve()
if output.exists():
    raise FileExistsError('保留已有压缩包：'+str(output))
if output.is_relative_to(root):
    raise ValueError('ZIP必须输出到快照目录之外，避免把自身打进包内')
assert (root/'catalog.json').is_file() and (root/'版本浏览清单.md').is_file()
excluded = {'.venv','__pycache__','.cache','rejected-downloads'}
output.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(output,'x',ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if path.is_file() and not any(part in excluded for part in relative.parts):
            archive.write(path,arcname=str(Path(root.name)/relative))
with ZipFile(output) as archive:
    assert archive.testzip() is None
    count = len(archive.infolist())
print('ZIP verified:',str(output),';',count,'files;',output.stat().st_size,'bytes')
