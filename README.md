# License Management System

একটি সম্পূর্ণ License Management System যেখানে আপনি লাইসেন্স তৈরি, দেখতে এবং ম্যানেজ করতে পারবেন।

## বৈশিষ্ট্য

- ✅ লাইসেন্স তৈরি করা (Username, Amount, License Key সহ)
- ✅ লাইসেন্স তালিকা দেখানো
- ✅ লাইসেন্স খুঁজে বের করা (Search)
- ✅ লাইসেন্স মুছে ফেলা
- ✅ Auto-generate License Key
- ✅ Modern এবং Responsive UI

## ইনস্টলেশন

### 1. Python Dependencies ইনস্টল করুন

```bash
pip install -r requirements.txt
```

### 2. সার্ভার চালু করুন

```bash
python server.py
```

সার্ভার `http://localhost:5000` এ চালু হবে।

### 3. Frontend খুলুন

`frontend` ফোল্ডারে `index.html` ফাইলটি ব্রাউজারে খুলুন। 

**অথবা** একটি local server ব্যবহার করুন:

```bash
# Python 3
cd frontend
python -m http.server 8000
```

তারপর ব্রাউজারে `http://localhost:8000` খুলুন।

## ব্যবহার

1. **লাইসেন্স তৈরি করুন:**
   - Username দিন
   - Amount দিন (default: 0)
   - License Key দিন অথবা Generate বাটন চাপুন
   - Create বাটন চাপুন

2. **লাইসেন্স খুঁজুন:**
   - Search bar এ Username বা License Key লিখুন

3. **লাইসেন্স মুছুন:**
   - Actions কলামে Delete বাটন চাপুন

## API Endpoints

- `GET /api/licenses` - সব লাইসেন্স পাওয়া
- `GET /api/licenses?search=term` - Search করা
- `POST /api/licenses` - নতুন লাইসেন্স তৈরি
- `DELETE /api/licenses/<id>` - লাইসেন্স মুছুন
- `GET /api/generate-key` - Random License Key তৈরি

## Database

SQLite database (`licenses.db`) automatically তৈরি হবে যখন প্রথমবার সার্ভার চালু করবেন।

## ফাইল স্ট্রাকচার

```
.
├── server.py              # Flask backend server
├── requirements.txt       # Python dependencies
├── licenses.db           # SQLite database (auto-generated)
├── frontend/
│   ├── index.html        # Main HTML file
│   ├── styles.css        # CSS styling
│   └── script.js         # JavaScript functionality
└── README.md             # Documentation
```

## Notes

- সার্ভার চালু থাকা অবস্থায় frontend কাজ করবে
- CORS enabled আছে, তাই cross-origin requests কাজ করবে
- Database automatically initialize হবে প্রথমবার

