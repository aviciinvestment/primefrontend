from PIL import Image

def remove_black_bg_smooth(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        brightness = max(item[0], item[1], item[2])
        
        if brightness < 45:
            # Smoothly feather the alpha for dark pixels
            alpha = int((brightness / 45) ** 1.5 * 255)
            newData.append((item[0], item[1], item[2], alpha))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

input_path = r"C:\Users\HP\.gemini\antigravity-ide\brain\b1ab1f55-35e3-4b49-9d58-be52ef62e53e\student_cutout_1789333965760.jpg"
output_path = r"c:\Users\HP\OneDrive\Desktop\primeopportunity\client\public\student_cutout_v3.png"

remove_black_bg_smooth(input_path, output_path)
print("Success")
