from rembg import remove
from PIL import Image

input_path = r"C:\Users\HP\.gemini\antigravity-ide\brain\b1ab1f55-35e3-4b49-9d58-be52ef62e53e\student_cutout_1789333965760.jpg"
output_path = r"c:\Users\HP\OneDrive\Desktop\primeopportunity\client\public\student_cutout_v3.png"

input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)
print("Success")
