import fitz
import io
import os
from PIL import Image
import pytesseract
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

# ── FIXED PDF Reader ─────────────────────────────────────
def extract_pdf_text(file_path: str) -> str:
    doc = fitz.open(file_path)
    full_text = ""

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)

        # Try normal text first
        text = page.get_text().strip()

        if len(text) > 100:
            print(f"✅ Page {page_num+1}: Normal text extracted")
            full_text += text
        else:
            # Your PDF is image-based → use OCR
            print(f"🔍 Page {page_num+1}: Running OCR...")
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))

            # ✅ OCR config for table + structured content
            custom_config = r'--oem 3 --psm 6'
            text = pytesseract.image_to_string(img, config=custom_config)
            full_text += f"\n{text}"

    doc.close()

    print("\n" + "="*50)
    print("📄 EXTRACTED TEXT:")
    print(full_text)
    print("="*50 + "\n")

    return full_text.strip()


# ── Analyzer ─────────────────────────────────────────────
def analyze_report(file_path: str) -> str:
    report_text = extract_pdf_text(file_path)

    if not report_text or len(report_text) < 50:
        return "❌ PDF text extraction failed. Check Tesseract installation."

    response = client.chat.completions.create(
        model="meta/llama-3.1-8b-instruct",
        messages=[
            {
                "role": "system",
                "content": """You are a document analyst.
RULES:
- Use ONLY the text given to you
- Extract every name, number, table, result
- NEVER say 'details not provided'
- NEVER say 'content unclear'

Format your response as:
### 📄 Document Type
### 📝 Summary
### ⚠️ Key Findings
### 📊 Data / Results
### 💡 Simple Explanation
### ⚠️ Note"""
            },
            {
                "role": "user",
                "content": f"Analyze this document:\n\n{report_text}"
            }
        ],
        temperature=0.1,
        max_tokens=1500,
    )

    return response.choices[0].message.content


# ── Run ──────────────────────────────────────────────────
if __name__ == "__main__":
    result = analyze_report("10a243c4-9dfc-44e5-83b4-a3b2923b9e36.pdf")
    print("FINAL RESULT:")
    print(result)
