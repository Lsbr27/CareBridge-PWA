#!/usr/bin/env python3
import sys
import pdfplumber


def main():
    if len(sys.argv) < 2:
        print("", end="")
        return

    pdf_path = sys.argv[1]
    chunks = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text:
                chunks.append(text)

    print("\n".join(chunks), end="")


if __name__ == "__main__":
    main()
