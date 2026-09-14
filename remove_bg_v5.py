from PIL import Image

def remove_black_bg_aggressively(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        brightness = max(item[0], item[1], item[2])
        
        if brightness < 80:
            if brightness < 30:
                alpha = 0
            else:
                alpha = int(((brightness - 30) / 50) ** 2 * 255)
            # Remove any green tint by pushing dark pixels towards grayscale before applying alpha
            gray = int(sum(item[:3])/3)
            newData.append((gray, gray, gray, alpha))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

input_path = r"C:\Users\HP\.gemini\antigravity-ide\brain\b1ab1f55-35e3-4b49-9d58-be52ef62e53e\student_cutout_1789333965760.jpg"
output_path = r"c:\Users\HP\OneDrive\Desktop\primeopportunity\client\public\student_cutout_v5.png"

remove_black_bg_aggressively(input_path, output_path)
print("Aggressive cutout done")
