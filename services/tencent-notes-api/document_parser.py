#!/usr/bin/env python3
"""Ephemeral document parser for the Notes API. Reads bytes from stdin, JSON to stdout."""
import io
import json
import sys

MAX_BYTES = 25 * 1024 * 1024
MAX_TEXT_CHARS = 500_000
SUPPORTED = {"pdf", "docx", "txt", "md", "markdown"}


class ParseError(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(message)


def normalized(value):
    return "\n\n".join(part.strip() for part in value.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n").split("\n\n") if part.strip())


def parse_pdf(data):
    try:
        from pypdf import PdfReader
        document = PdfReader(io.BytesIO(data), strict=False)
    except Exception as error:
        raise ParseError("INVALID_PDF", "PDF 损坏、格式无效或无法读取。") from error
    if document.is_encrypted:
        raise ParseError("ENCRYPTED_PDF", "PDF 已加密或受密码保护，不能在服务端解析。")
    try:
        pages = [normalized(page.extract_text() or "") for page in document.pages]
        text = "\n\n".join(page for page in pages if page)
        warnings = []
        status = "ready"
        if not text:
            status = "ocr_required"
            warnings.append("OCR_REQUIRED：未提取到可搜索文字；该 PDF 可能是扫描件或纯图片。")
        return {"text": text, "pageCount": len(document.pages), "paragraphCount": len([part for part in text.split("\n\n") if part]), "warnings": warnings, "status": status}
    except ParseError:
        raise
    except Exception as error:
        raise ParseError("INVALID_PDF", "PDF 正文提取失败；文件可能损坏或包含不受支持的对象。") from error


def parse_docx(data):
    try:
        from docx import Document
        document = Document(io.BytesIO(data))
    except Exception as error:
        raise ParseError("INVALID_DOCX", "DOCX 损坏、格式无效或无法读取。") from error
    paragraphs = [normalized(paragraph.text) for paragraph in document.paragraphs]
    text = "\n\n".join(part for part in paragraphs if part)
    return {"text": text, "paragraphCount": len([part for part in paragraphs if part]), "warnings": ([] if text else ["DOCX 未包含可提取的正文文本。"]), "status": "ready"}


def parse_text(data):
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = data.decode("gb18030")
        except UnicodeDecodeError as error:
            raise ParseError("UNSUPPORTED_TEXT_ENCODING", "TXT/MD 必须是 UTF-8 或 GB18030 编码。") from error
    text = normalized(text)
    return {"text": text, "paragraphCount": len([part for part in text.split("\n\n") if part]), "warnings": ([] if text else ["文本文件为空或没有可提取内容。"]), "status": "ready"}


def parse(data, filename):
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in SUPPORTED:
        raise ParseError("UNSUPPORTED_FILE", "仅支持 PDF、DOCX、TXT 和 Markdown 文件。")
    if len(data) > MAX_BYTES:
        raise ParseError("FILE_TOO_LARGE", "文件超过 25 MB 限制。")
    if not data:
        raise ParseError("EMPTY_FILE", "文件为空，无法解析。")
    if extension == "pdf":
        result = parse_pdf(data)
    elif extension == "docx":
        result = parse_docx(data)
    else:
        result = parse_text(data)
    if len(result["text"]) > MAX_TEXT_CHARS:
        result["text"] = result["text"][:MAX_TEXT_CHARS]
        result["warnings"].append("正文超过 500,000 字符，临时预览已截断；原文件未被修改。")
        result["status"] = "partial"
    return {"fileName": filename, "kind": "md" if extension == "markdown" else extension, "byteSize": len(data), "temporary": True, "storageWritten": False, **result}


def main():
    filename = sys.argv[1] if len(sys.argv) > 1 else ""
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    try:
        print(json.dumps({"ok": True, "document": parse(data, filename)}, ensure_ascii=False))
    except ParseError as error:
        print(json.dumps({"ok": False, "error": error.code, "message": error.message}, ensure_ascii=False))
    except Exception:
        print(json.dumps({"ok": False, "error": "PARSE_FAILED", "message": "文档解析失败。"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
