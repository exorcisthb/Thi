import sys
sys.stdout.reconfigure(encoding='utf-8')
import os, re, json, openpyxl

app_public = r"E:\Thi Thử Các môn theo bộ đề\quiz-app\public"
data_dir = os.path.join(app_public, "data")
os.makedirs(data_dir, exist_ok=True)

def sanitize_slug(name):
    s = re.sub(r'[^a-zA-Z0-9_-]+', '_', name)
    s = re.sub(r'_+', '_', s).strip('_')
    return s

def parse_dap_an_txt(txt_path):
    answers = {}
    if not os.path.exists(txt_path):
        return answers
    with open(txt_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    matches = re.findall(r'C(?:â|a)u\s*(\d+)[\s:]+([A-E])', content, re.IGNORECASE)
    for qnum, ans in matches:
        answers[int(qnum)] = ans.upper()
    if not answers:
        matches = re.findall(r'(\d+)[\s:]+([A-E])', content)
        for qnum, ans in matches:
            answers[int(qnum)] = ans.upper()
    return answers

def process_and_export(base_dir, subject_code, output_json):
    fe_dir = os.path.join(base_dir, "De_Thi_FE")
    dest_img_subj = os.path.join(app_public, "images", subject_code)
    
    folders = sorted([f for f in os.listdir(fe_dir) if os.path.isdir(os.path.join(fe_dir, f))])
    sets = []
    
    for f in folders:
        fpath = os.path.join(fe_dir, f)
        set_name_clean = re.sub(r'^\d+\.\s*', '', f).strip()
        slug = sanitize_slug(f)
        set_id = f"{subject_code.lower()}-{slug.lower()}"
        
        txt_path = os.path.join(fpath, "DAP_AN_TRA_CUU.txt")
        txt_ans = parse_dap_an_txt(txt_path)
        
        excel_files = [x for x in os.listdir(fpath) if x.endswith('.xlsx')]
        excel_data = {}
        if excel_files:
            try:
                wb = openpyxl.load_workbook(os.path.join(fpath, excel_files[0]), read_only=True)
                sheet = wb.active
                for row in list(sheet.iter_rows(values_only=True))[1:]:
                    if row[0] is not None:
                        try:
                            qnum = int(row[0])
                            ans = str(row[1]).strip() if row[1] is not None else ''
                            ocr = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ''
                            img_file = str(row[3]).strip() if len(row) > 3 and row[3] is not None else f"Cau_{qnum:02d}.png"
                            excel_data[qnum] = {
                                'ans': ans,
                                'ocr': ocr,
                                'img': img_file
                            }
                        except:
                            pass
            except Exception as e:
                print(f"Error reading excel in {f}: {e}")
                
        img_dir = os.path.join(fpath, "Hinh_Anh")
        dest_slug_dir = os.path.join(dest_img_subj, slug)
        
        existing_imgs = set()
        if os.path.exists(dest_slug_dir):
            existing_imgs = set(os.listdir(dest_slug_dir))
            
        total_q = max(len(existing_imgs), len(excel_data), len(txt_ans))
        if total_q == 0:
            continue
            
        questions = []
        for qidx in range(1, total_q + 1):
            qnum_str = f"{qidx:02d}"
            target_img = f"Cau_{qnum_str}.png"
            
            # Check if image actually exists on disk
            img_rel_url = None
            if target_img in existing_imgs:
                img_rel_url = f"/images/{subject_code}/{slug}/{target_img}"
            elif qidx in excel_data and excel_data[qidx]['img'] in existing_imgs:
                img_rel_url = f"/images/{subject_code}/{slug}/{excel_data[qidx]['img']}"
                
            ans = 'A'
            answer_note = ''
            if qidx in txt_ans and txt_ans[qidx] in ['A', 'B', 'C', 'D', 'E']:
                ans = txt_ans[qidx]
            elif qidx in excel_data and excel_data[qidx]['ans'] in ['A', 'B', 'C', 'D', 'E']:
                ans = excel_data[qidx]['ans']
            else:
                answer_note = 'Xem trên ảnh'
                
            ocr_text = ''
            if qidx in excel_data and excel_data[qidx]['ocr']:
                ocr_text = excel_data[qidx]['ocr']
            if not ocr_text:
                ocr_text = f"Câu {qidx} (Xem nội dung chi tiết trong hình ảnh đề thi)"
                
            explanation = ''
            if answer_note == 'Xem trên ảnh':
                explanation = 'Đáp án câu hỏi này được đánh dấu trực tiếp trên hình ảnh đề thi.'
            else:
                explanation = f'Đáp án đúng: {ans}'
                
            q_obj = {
                'id': f"{set_id}-q{qidx}",
                'content': ocr_text,
                'options': {
                    'A': 'A',
                    'B': 'B',
                    'C': 'C',
                    'D': 'D',
                    'E': ''
                },
                'correctAnswer': ans,
                'correctAnswers': [ans],
                'weight': 1,
                'explanation': explanation,
            }
            if img_rel_url:
                q_obj['imageUrl'] = img_rel_url
            if answer_note:
                q_obj['answerNote'] = answer_note
                
            questions.append(q_obj)
            
        sets.append({
            'id': set_id,
            'name': set_name_clean,
            'subject': subject_code,
            'questions': questions,
            'createdAt': 1729800000000 + len(sets) * 1000,
        })
        
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(sets, f, ensure_ascii=False, indent=2)
    print(f"Generated {subject_code}: {len(sets)} sets, {sum(len(s['questions']) for s in sets)} questions to {output_json}")

process_and_export(r"D:\Kì học\ss9\HCM202", "HCM202", os.path.join(data_dir, "hcm-sets.json"))
process_and_export(r"D:\Kì học\ss9\VNR202", "VNR202", os.path.join(data_dir, "vnr-sets.json"))
