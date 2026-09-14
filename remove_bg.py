from PIL import Image

def remove_black_bg(input_path, output_path, tolerance=30):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        if item[0] < tolerance and item[1] < tolerance and item[2] < tolerance:
            newData.append((0, 0, 0, 0)) # Transparent
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

input_file = r"C:\Users\HP\.gemini\antigravity-ide\brain\b1ab1f55-35e3-4b49-9d58-be52ef62e53e\student_cutout_1789333965760.jpg"
output_file = r"c:\Users\HP\OneDrive\Desktop\primeopportunity\client\public\student_cutout.png"

remove_black_bg(input_file, output_file)
print("Success")
