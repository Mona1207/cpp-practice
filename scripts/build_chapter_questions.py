#!/usr/bin/env python3
"""Build the website question bank from the chapter-PDF OCR audit.

Most questions already existed in the earlier hand-cleaned bank, so this
script reuses those clean prompts, answers, and explanations when possible.
New PDF-only questions are supplied as explicit overrides.
"""

from __future__ import annotations

import json
import re
import subprocess
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_JSON = ROOT / "tmp" / "pdfs" / "chapter_ocr" / "ocr_cards.json"
OLD_JSON = ROOT / "data" / "questions.json"
OUT_JSON = ROOT / "data" / "questions.json"

SECTION_TITLES = {
    "第一章": "第一章 面向对象与数据表示",
    "第二章": "第二章 C++简单程序设计",
    "第三章": "第三章 函数与类基础",
    "第四章": "第四章 构造析构与组合类",
    "第五章": "第五章 静态常成员、友元与数组",
    "第六章": "第六章 指针与动态内存",
    "第七章": "第七章 字符串与继承基础",
    "第八章": "第八章 继承访问、虚基类与运算符重载",
    "第九章": "第九章 虚函数、多态与模板",
}

OLD_MAP = {
    **{i: i for i in range(1, 11)},
    **{i: i - 1 for i in range(12, 22)},
    **{i: i - 2 for i in range(23, 32)},
    33: 38,
    36: 30,
    37: 31,
    38: 32,
    39: 33,
    40: 34,
    41: 35,
    44: 37,
    45: 39,
    46: 100,
    47: 60,
    48: 61,
    49: 62,
    50: 63,
    51: 64,
    52: 65,
    53: 66,
    54: 67,
    55: 68,
    56: 69,
    57: 74,
    58: 75,
    59: 76,
    60: 77,
    61: 78,
    62: 79,
    63: 80,
    65: 81,
    66: 82,
    67: 83,
    68: 85,
    70: 84,
    71: 70,
    72: 36,
    73: 71,
    74: 72,
    75: 73,
    76: 40,
    77: 41,
    78: 42,
    79: 97,
    80: 98,
    81: 43,
    82: 44,
    83: 45,
    84: 46,
    85: 47,
    86: 48,
    87: 49,
    90: 99,
    **{i: i - 41 for i in range(91, 100)},
    100: 59,
}

MANUAL = {
    11: {
        "title": "面向对象方法与编码表示综合题",
        "type": "program",
        "prompt": "1. 面向对象编程语言有哪些特点？\n2. 什么是对象？什么是面向对象方法？这种方法有哪些特点？\n3. 简要比较原码、反码、补码等几种编码方法。",
        "referenceAnswer": "1. 面向对象编程语言通常支持封装、继承、多态和抽象。封装把数据和操作组织在类中并通过访问控制保护内部状态；继承支持代码复用和类型扩展；多态允许同一接口在不同对象上表现出不同行为；抽象用于抓住问题的本质特征。\n\n2. 对象是具有状态、行为和标识的实体，是类的实例。面向对象方法是把问题中的实体抽象为对象，通过对象之间的消息/函数调用协作完成任务的方法。它的特点是接近现实建模、模块边界清楚、复用性和可维护性较好。\n\n3. 原码用最高位表示符号，其余位表示数值；反码在负数时符号位不变、数值位按位取反；补码在反码基础上加 1。计算机通常用补码表示有符号整数，因为补码能统一加减法运算，并且只有一个零。",
        "explanation": "本题考查第一章的三个基础块：面向对象特征、对象/方法的概念、以及整数机器表示。答题时要把“概念定义”和“为什么这样设计”说清楚。",
    },
    22: {
        "title": "第二章课后作业清单",
        "type": "program",
        "prompt": "请完成第二章课后作业（P60-P63）：2-2、2-7、2-8、2-11、2-21、2-22、2-23、2-26、2-27、2-30。",
        "referenceAnswer": "该 PDF 只给出了教材页码和题号，没有包含这些课后题的完整题干，因此无法从当前文件可靠还原逐题答案。\n\n复习时建议按以下知识点完成：表达式和运算符优先级、类型转换、输入输出、if/switch 分支、while/do-while/for 循环、break 与 continue、简单程序跟踪。若补充教材 P60-P63 的题目截图，可以继续为每个小题生成对应答案和解析。",
        "explanation": "这里不直接编造教材题答案，因为源文件没有题干。当前题库把它作为作业清单保留，并给出对应复习范围。",
    },
    32: {
        "title": "函数传参、重载、质数与 Fibonacci 综合题",
        "type": "program",
        "prompt": "1. 比较值传递和引用传递的相同点与不同点。\n2. 调用被重载的函数时，通过什么区分被调用的是哪个函数？\n3. 编写函数判别一个数是否是质数，在主程序中实现输入输出。\n4. 用递归的方法编写函数求 Fibonacci 级数：F(n)=F(n-1)+F(n-2)（n>2），F(1)=F(2)=1，并观察递归调用过程。",
        "referenceAnswer": "#include <iostream>\nusing namespace std;\n\nbool isPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i * i <= n; ++i) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}\n\nint fib(int n) {\n    if (n == 1 || n == 2) return 1;\n    return fib(n - 1) + fib(n - 2);\n}\n\nint main() {\n    int n;\n    cin >> n;\n    cout << (isPrime(n) ? \"prime\" : \"not prime\") << endl;\n    cout << fib(n) << endl;\n    return 0;\n}\n\n概念题：值传递和引用传递都会把实参信息传给形参；值传递形参是副本，修改形参不影响实参；引用传递形参是实参别名，修改形参会影响实参且可避免大对象复制。重载函数主要通过参数个数、参数类型和参数顺序区分，不能只靠返回值区分。",
        "explanation": "质数判断只需试除到平方根；Fibonacci 递归要设置边界条件。函数重载解析看函数签名中的参数列表，返回值不参与重载区分。",
    },
    34: {
        "title": "Cube 类面积体积与相等判断",
        "type": "program",
        "prompt": "案例 1：设计立方体类 Cube，求出立方体的表面积和体积，并判断两个立方体是否相等（分别用全局函数和成员函数实现）。",
        "referenceAnswer": "#include <iostream>\nusing namespace std;\n\nclass Cube {\n    double length;\npublic:\n    Cube(double l = 0) : length(l) {}\n    double area() const { return 6 * length * length; }\n    double volume() const { return length * length * length; }\n    bool sameByMember(const Cube& other) const {\n        return length == other.length;\n    }\n    double getLength() const { return length; }\n};\n\nbool sameByGlobal(const Cube& a, const Cube& b) {\n    return a.getLength() == b.getLength();\n}\n\nint main() {\n    Cube c1(3), c2(3);\n    cout << c1.area() << \" \" << c1.volume() << endl;\n    cout << c1.sameByMember(c2) << \" \" << sameByGlobal(c1, c2) << endl;\n    return 0;\n}",
        "explanation": "立方体只需保存边长。成员函数比较时左操作数就是当前对象；全局函数比较时两个对象都作为参数传入。",
    },
    35: {
        "title": "Circle 与 Point 判断点和圆关系",
        "type": "program",
        "prompt": "案例 2：设计 Circle 类和 Point 类，计算点在圆内还是圆外部，分别按成员函数和全局函数两种形式实现。案例 3：将类的声明与实现分开，做成多文件结构。",
        "referenceAnswer": "#include <iostream>\nusing namespace std;\n\nclass Point {\n    double x, y;\npublic:\n    void set(double x0, double y0) { x = x0; y = y0; }\n    double getX() const { return x; }\n    double getY() const { return y; }\n};\n\nclass Circle {\n    Point center;\n    double radius;\npublic:\n    void set(Point c, double r) { center = c; radius = r; }\n    bool containsByMember(const Point& p) const {\n        double dx = p.getX() - center.getX();\n        double dy = p.getY() - center.getY();\n        return dx * dx + dy * dy <= radius * radius;\n    }\n    Point getCenter() const { return center; }\n    double getRadius() const { return radius; }\n};\n\nbool containsByGlobal(const Circle& c, const Point& p) {\n    double dx = p.getX() - c.getCenter().getX();\n    double dy = p.getY() - c.getCenter().getY();\n    return dx * dx + dy * dy <= c.getRadius() * c.getRadius();\n}\n\nint main() {\n    Point center, p;\n    center.set(0, 0);\n    p.set(1, 1);\n    Circle circle;\n    circle.set(center, 2);\n    cout << circle.containsByMember(p) << \" \" << containsByGlobal(circle, p) << endl;\n    return 0;\n}",
        "explanation": "比较点到圆心距离 d 与半径 r 即可。为避免开平方，可比较 d^2 与 r^2。多文件结构时通常把类声明放在 .h，成员函数实现放在 .cpp，main 单独放在测试文件中。",
    },
    42: {
        "title": "UML 关联多重性",
        "type": "choice",
        "prompt": "UML 中关联的多重性是指：",
        "options": [
            {"key": "A", "text": "一个类有多个方法被另一个类调用"},
            {"key": "B", "text": "一个类的对象能够与另一个类的多个对象相关联"},
            {"key": "C", "text": "一个类的某个方法被另一个类调用的次数"},
            {"key": "D", "text": "两个类所具有的相同的方法和属性"},
        ],
        "answer": "B",
        "answerText": "B",
        "explanation": "多重性描述关联两端对象数量上的约束，如 1、0..1、1..*、* 等。",
        "pitfalls": "A、C 把关联误解为方法调用；D 描述的是相似结构，不是关联数量约束。",
    },
    43: {
        "title": "类定义填空",
        "type": "fill",
        "prompt": "在下面横线处填上适当字句，完成类的定义。\nclass T {\npublic:\n    void init(int initx) { x = initx; }\n    int getx() { [填空1]; } // 取 x 值\nprivate:\n    [填空2];\n};",
        "answer": "return x;；int x",
        "answerText": "[填空1] return x;；[填空2] int x",
        "explanation": "`getx()` 的功能是返回私有数据成员 `x`，所以函数体应写 `return x;`。类中还必须在 `private` 区声明整型成员 `int x;`。",
    },
    69: {
        "title": "字符串连接：字符数组与 string",
        "type": "program",
        "prompt": "1. 编程实现两个字符串的连接，要求使用字符数组保存字符串，不使用系统函数。\n2. 使用 string 类声明字符串对象，重新实现上述问题。",
        "referenceAnswer": "#include <iostream>\n#include <string>\nusing namespace std;\n\nvoid concatCharArray(char a[], const char b[]) {\n    int i = 0, j = 0;\n    while (a[i] != '\\0') ++i;\n    while (b[j] != '\\0') {\n        a[i++] = b[j++];\n    }\n    a[i] = '\\0';\n}\n\nint main() {\n    char s1[200] = \"hello\";\n    char s2[] = \"cpp\";\n    concatCharArray(s1, s2);\n    cout << s1 << endl;\n\n    string a = \"hello\", b = \"cpp\";\n    a += b;\n    cout << a << endl;\n    return 0;\n}",
        "explanation": "字符数组版本要先找到第一个字符串末尾的 '\\0'，再逐字符复制第二个字符串并补结束符；string 版本可以直接使用 `+=` 或 `+` 完成连接。",
    },
    88: {
        "title": "不可重载的运算符",
        "type": "choice",
        "prompt": "下列运算符中，不可以重载的是：",
        "options": [
            {"key": "A", "text": "&&"},
            {"key": "B", "text": "&"},
            {"key": "C", "text": "|"},
            {"key": "D", "text": "?:"},
        ],
        "answer": "D",
        "answerText": "D",
        "explanation": "C++ 中条件运算符 `?:` 不能被重载。逻辑与、按位与、按位或可以重载。",
        "pitfalls": "`&&` 虽可重载，但重载后不再保持内置逻辑与的短路求值语义。",
    },
    89: {
        "title": "运算符重载描述",
        "type": "choice",
        "prompt": "下列关于运算符重载的描述中，错误的是：",
        "options": [
            {"key": "A", "text": "运算符重载不改变优先级"},
            {"key": "B", "text": "运算符重载后，原来运算符操作不可再用"},
            {"key": "C", "text": "运算符重载不改变结合性"},
            {"key": "D", "text": "运算符重载函数的参数个数与重载方式有关"},
        ],
        "answer": "B",
        "answerText": "B",
        "explanation": "重载只是在自定义类型上赋予运算符新的函数含义，不会取消该运算符对内置类型的原有操作。",
        "pitfalls": "A、C 是运算符重载的基本限制；D 也正确，成员函数和非成员函数的显式参数个数不同。",
    },
}

PROMPT_OVERRIDES = {
    19: {
        "title": "switch 穿透",
        "prompt": "以下程序输出结果为：\nvoid main() {\n    int x = 1, a = 0, b = 0;\n    switch (x) {\n    case 0: b++;\n    case 1: a++;\n    case 2: a++; b++;\n    }\n    cout << \"a=\" << a << \",b=\" << b;\n}",
        "options": [
            {"key": "A", "text": "a=2,b=1"},
            {"key": "B", "text": "a=1,b=1"},
            {"key": "C", "text": "a=1,b=0"},
            {"key": "D", "text": "a=2,b=2"},
        ],
        "answer": "A",
        "answerText": "A",
    },
    28: {
        "title": "函数匹配",
        "prompt": "若同时定义了如下函数，`fun(8, 3.1)` 调用的是下列哪个函数？",
        "options": [
            {"key": "A", "text": "void fun(float, int)"},
            {"key": "B", "text": "void fun(double, int)"},
            {"key": "C", "text": "void fun(char, float)"},
            {"key": "D", "text": "void fun(double, double)"},
        ],
        "answer": "D",
        "answerText": "D",
    },
    39: {
        "title": "类定义语句错误",
        "prompt": "下面类定义中，错误的语句是：\nclass sample {\npublic:\n    sample(int val);    // 1\n    ~sample();          // 2\n    sample();           // 3\nprivate:\n    int a = 2.5;        // 4\n};",
        "options": [
            {"key": "A", "text": "1"},
            {"key": "B", "text": "2"},
            {"key": "C", "text": "3"},
            {"key": "D", "text": "4"},
        ],
        "answer": "D",
        "answerText": "D",
    },
    54: {
        "title": "const/static 编译判断",
        "prompt": "class Test {\npublic:\n    Test() { a = 0; c = 0; }        // 1\n    int f(int m) const { a = m; }   // 2\n    void h(int b) { Test::b = b; }  // 3\n    static int g() { return a; }    // 4\nprivate:\n    int a;\n    static int b;\n    const int c;\n};\n在标注号码的行中，能被正确编译的是：",
        "options": [
            {"key": "A", "text": "1"},
            {"key": "B", "text": "2"},
            {"key": "C", "text": "3"},
            {"key": "D", "text": "4"},
        ],
        "answer": "C",
        "answerText": "C",
    },
    73: {
        "title": "字符指针赋值",
        "prompt": "设有 `char s1[10], *s2 = s1;`，则以下正确的语句是：",
        "options": [
            {"key": "A", "text": "s1[0] = \"computer\""},
            {"key": "B", "text": "s1[10] = \"computer\""},
            {"key": "C", "text": "s2 = \"computer\""},
            {"key": "D", "text": "*s2 = \"computer\""},
        ],
        "answer": "C",
        "answerText": "C",
    },
    74: {
        "title": "字符串数组比较",
        "prompt": "设有 `char *s[] = {\"1234\", \"5678\", \"9012\", \"3456\", \"7890\"};`，则表达式 `*s[1] > *s[3]` 比较的是：",
        "options": [
            {"key": "A", "text": "\"1234\" 和 \"9012\""},
            {"key": "B", "text": "'5' 和 '3'"},
            {"key": "C", "text": "'1' 和 '9'"},
            {"key": "D", "text": "\"5678\" 和 \"3456\""},
        ],
        "answer": "B",
        "answerText": "B",
    },
    85: {
        "title": "私有成员访问",
        "prompt": "类 O 定义了私有函数 F1，P 和 Q 为 O 的派生类，定义 `class P: protected O {...}; class Q: public O {...};`，则可以访问 F1 的是：",
        "options": [
            {"key": "A", "text": "O 的对象"},
            {"key": "B", "text": "P 类内"},
            {"key": "C", "text": "Q 类内"},
            {"key": "D", "text": "O 类内"},
        ],
        "answer": "D",
        "answerText": "D",
    },
    86: {
        "title": "派生类构造函数初始化基类",
        "prompt": "有如下类定义：\nclass XA {\n    int x;\npublic:\n    XA(int n) { x = n; }\n};\nclass XB: public XA {\n    int y;\npublic:\n    XB(int a, int b);\n};\n在构造函数 XB 的定义中，正确的是：",
        "options": [
            {"key": "A", "text": "XB::XB(int a,int b) : x(a), y(b) {}"},
            {"key": "B", "text": "XB::XB(int a,int b) : XA(a), y(b) {}"},
            {"key": "C", "text": "XB::XB(int a,int b) : x(a), XB(b) {}"},
            {"key": "D", "text": "XB::XB(int a,int b) : XA(a), XB(b) {}"},
        ],
        "answer": "B",
        "answerText": "B",
    },
}


def infer_type(raw: str) -> str:
    first = raw.splitlines()[0]
    if "填空题" in first:
        return "fill"
    if "主观题" in first:
        return "program"
    return "choice"


def clean_item(base: dict, original_index: int, card: dict, number: int) -> dict:
    item = deepcopy(base)
    item["id"] = f"q{number:03d}"
    item["number"] = number
    item["section"] = SECTION_TITLES[card["chapter"]]
    item["type"] = base.get("type", infer_type(card["text"]))
    item["source"] = f"{card['source']} 第{card['page']}页"
    item.setdefault("options", [])
    item.setdefault("answer", item.get("answerText", ""))
    item.setdefault("answerText", item.get("answer", ""))
    item.setdefault("referenceAnswer", "")
    item.setdefault("explanation", "")
    item.setdefault("pitfalls", "")
    if item["type"] != "choice":
        item["options"] = []
    return item


def main() -> None:
    old_raw = subprocess.check_output(["git", "show", "HEAD:data/questions.json"], cwd=ROOT, text=True)
    old_data = json.loads(old_raw)
    old_questions = {idx: q for idx, q in enumerate(old_data["questions"], 1)}
    cards = json.loads(OCR_JSON.read_text(encoding="utf-8"))

    questions: list[dict] = []
    for original_index, card in enumerate(cards, 1):
        if not re.search(r"(单选题|多选题|填空题|主观题)", card["text"]):
            continue
        if original_index in MANUAL:
            base = deepcopy(MANUAL[original_index])
        else:
            old_index = OLD_MAP[original_index]
            base = deepcopy(old_questions[old_index])
            base["type"] = infer_type(card["text"])
        if original_index in PROMPT_OVERRIDES:
            base.update(deepcopy(PROMPT_OVERRIDES[original_index]))
        questions.append(clean_item(base, original_index, card, len(questions) + 1))

    sections = list(dict.fromkeys(q["section"] for q in questions))
    payload = {
        "source": "按章节 PDF 更新：第一章至第九章",
        "questionCount": len(questions),
        "choiceCount": sum(q["type"] == "choice" for q in questions),
        "fillCount": sum(q["type"] == "fill" for q in questions),
        "programCount": sum(q["type"] == "program" for q in questions),
        "sections": sections,
        "questions": questions,
        "notes": [{"title": section} for section in sections],
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Wrote {payload['questionCount']} questions: "
        f"{payload['choiceCount']} choice, {payload['fillCount']} fill, {payload['programCount']} program"
    )


if __name__ == "__main__":
    main()
