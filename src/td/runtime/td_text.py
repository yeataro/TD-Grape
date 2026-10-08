"""Text for people sent from TD to the editor (design-interview Q58): the same shape as the editor's
`tr()` — a code, the English original and parameters. The editor shows its own translation of the
code when it has one, otherwise the English original; it never needs to know each code in advance.
Write the code and the original as complete literals (tools/dev/locales.cjs reads them from here too).
TD 給人看的文字：和編輯器的 tr() 同形——代號、英文原文、參數。編輯器有翻譯就用翻譯，沒有就用英文原文。
"""


def tr(code, source, **params):
    return {'code': code, 'source': source, 'params': {k: v for k, v in params.items()}} if params else {'code': code, 'source': source}


def english(message):
    """The English original with its parameters filled in, e.g. for TD's status bar. 英文原文填入參數。"""
    text = message['source']
    for key, value in message.get('params', {}).items():
        text = text.replace('{' + key + '}', str(value))
    return text
