"""Monta o pôster do Athonis sobre o TEMPLATE_POSTER_PORTFOLIO.pptx oficial."""
import copy
import sys

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Cm, Pt

# Baixe o modelo em github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook (demoday/).
SRC = "TEMPLATE_POSTER_PORTFOLIO.pptx"
OUT = sys.argv[1] if len(sys.argv) > 1 else "Poster_Athonis.pptx"

VERMELHO = RGBColor(0xC0, 0x00, 0x00)
ESCURO = RGBColor(0x26, 0x26, 0x26)
CINZA = RGBColor(0x59, 0x59, 0x59)
CLARO = RGBColor(0xF2, 0xF2, 0xF2)
ROSA = RGBColor(0xFB, 0xE9, 0xE9)
BRANCO = RGBColor(0xFF, 0xFF, 0xFF)

prs = Presentation(SRC)
slide = prs.slides[0]
shapes = {}
for sh in slide.shapes:
    shapes.setdefault(sh.name, []).append(sh)


def by_text(prefix):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip().startswith(prefix):
            return sh
    raise KeyError(prefix)


# ------------------------------------------------------------- texto


def set_paragraphs(shape, paragraphs, size=None):
    """Reescreve o texto mantendo o estilo do 1º parágrafo/run, sem o realce amarelo.

    paragraphs: lista de parágrafos; cada um é str ou lista de (texto, opções).
    opções: bold, highlight (marca pendência do piloto), bullet.
    """
    txBody = shape.text_frame._txBody
    ps = txBody.findall(qn("a:p"))
    base_p = copy.deepcopy(ps[0])
    base_r = None
    for p in ps:
        r = p.find(qn("a:r"))
        if r is not None:
            base_r = copy.deepcopy(r)
            break
    for p in ps:
        txBody.remove(p)
    for item in paragraphs:
        runs = [(item, {})] if isinstance(item, str) else item
        p = copy.deepcopy(base_p)
        for child in list(p):
            if child.tag != qn("a:pPr"):
                p.remove(child)
        pPr = p.find(qn("a:pPr"))
        bullet = any(o.get("bullet") for _, o in runs)
        if pPr is None:
            pPr = etree.SubElement(p, qn("a:pPr"))
            p.insert(0, pPr)
        if bullet:
            pPr.set("marL", str(Cm(0.8)))
            pPr.set("indent", str(-Cm(0.6)))
            for tag in ("a:buNone", "a:buChar", "a:buAutoNum"):
                for e in pPr.findall(qn(tag)):
                    pPr.remove(e)
            bu = etree.SubElement(pPr, qn("a:buChar"))
            bu.set("char", "•")
        for text, opts in runs:
            r = copy.deepcopy(base_r)
            rPr = r.find(qn("a:rPr"))
            if rPr is None:
                rPr = etree.SubElement(r, qn("a:rPr"))
                r.insert(0, rPr)
            for hl in rPr.findall(qn("a:highlight")):
                rPr.remove(hl)
            if size:
                rPr.set("sz", str(int(size * 100)))
            rPr.set("b", "1" if opts.get("bold") else "0")
            rPr.set("i", "1" if opts.get("italic") else "0")
            if opts.get("highlight"):
                hl = etree.SubElement(rPr, qn("a:highlight"))
                clr = etree.SubElement(hl, qn("a:srgbClr"))
                clr.set("val", "FFFF00")
                # a:highlight precisa vir depois de fill/efeitos e antes das fontes
                rPr.remove(hl)
                fonts = [rPr.find(qn(t)) for t in ("a:latin", "a:ea", "a:cs", "a:sym")]
                fonts = [f for f in fonts if f is not None]
                if fonts:
                    fonts[0].addprevious(hl)
                else:
                    rPr.append(hl)
            r.find(qn("a:t")).text = text
            p.append(r)
        txBody.append(p)


def set_text_keep(shape, text):
    """Troca só o texto de uma caixa de 1 parágrafo (títulos, legendas)."""
    set_paragraphs(shape, [text])


def B(t):
    return (t, {"bold": True})


def N(t):
    return (t, {})


def H(t):
    return (t, {"highlight": True})


def bullet(*runs):
    return [(t, dict(o, bullet=True)) for t, o in runs]


# ------------------------------------------------------------- formas


def box(x, y, w, h, text="", fill=CLARO, line=CINZA, size=20, bold=False, color=ESCURO,
        shape=MSO_SHAPE.ROUNDED_RECTANGLE, name=None, align=PP_ALIGN.CENTER, lw=1.5):
    s = slide.shapes.add_shape(shape, Cm(x), Cm(y), Cm(w), Cm(h))
    if name:
        s.name = name
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
    s.shadow.inherit = False
    tf = s.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Cm(0.2)
    tf.margin_top = tf.margin_bottom = Cm(0.1)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    lines = text.split("\n") if text else []
    for i, line_text in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line_text
        r.font.size = Pt(size if i == 0 else max(20, size - 4))
        r.font.bold = bold if i == 0 else False
        r.font.color.rgb = color
        r.font.name = "Arial"
    return s


def arrow(x1, y1, x2, y2, color=CINZA, width=2.25, head=True, dashed=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Cm(x1), Cm(y1), Cm(x2), Cm(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    if dashed:
        d = etree.SubElement(ln, qn("a:prstDash"))
        d.set("val", "dash")
    if head:
        t = etree.SubElement(ln, qn("a:tailEnd"))
        t.set("type", "triangle")
        t.set("w", "med")
        t.set("len", "med")
    return c


def label(x, y, w, h, text, size=20, bold=False, color=ESCURO, align=PP_ALIGN.CENTER):
    return box(x, y, w, h, text, fill=None, line=None, size=size, bold=bold, color=color,
               shape=MSO_SHAPE.RECTANGLE, align=align)


def actor(cx, top, nome):
    """Ator UML (boneco) com o nome embaixo."""
    head = slide.shapes.add_shape(MSO_SHAPE.OVAL, Cm(cx - 0.6), Cm(top), Cm(1.2), Cm(1.2))
    head.fill.background()
    head.line.color.rgb = ESCURO
    head.line.width = Pt(2.5)
    arrow(cx, top + 1.2, cx, top + 3.2, ESCURO, 2.5, head=False)       # tronco
    arrow(cx - 1.1, top + 1.9, cx + 1.1, top + 1.9, ESCURO, 2.5, head=False)  # braços
    arrow(cx, top + 3.2, cx - 0.9, top + 4.6, ESCURO, 2.5, head=False)  # pernas
    arrow(cx, top + 3.2, cx + 0.9, top + 4.6, ESCURO, 2.5, head=False)
    label(cx - 2.2, top + 4.7, 4.4, 1.0, nome, size=20, bold=True)


def remove(shape):
    shape._element.getparent().remove(shape._element)


# ===================================================== cabeçalho

set_paragraphs(shapes["Rectangle 2"][0], [[B("ATHONIS: ENTREGAS RASTREÁVEIS EM CAMPO")]], size=50)

nome = shapes["Rectangle 99"][0]
set_paragraphs(nome, ["Kevin Chedid El Azar", "kevin.azal@catolicasc.edu.br",
                      "Graduando do curso de Bacharelado em Engenharia de Software da Católica de SC"])
# o template tem estilos diferentes por linha (nome, e-mail, curso): reaplica cor/itálico
cores = ["000000", "000099", "C00000"]
tamanhos = [37, 30, 26]
for p, cor, tam in zip(nome.text_frame.paragraphs, cores, tamanhos):
    p.alignment = PP_ALIGN.CENTER
    for r in p.runs:
        r.font.size = Pt(tam)
        r.font.italic = True
        r.font.bold = True
        r.font.color.rgb = RGBColor.from_string(cor)

# ===================================================== introdução

set_paragraphs(by_text("A introdução"), [
    [N("A Forte Acessórios para Móveis (Jaraguá do Sul/SC) já gerava rotas otimizadas, mas perdia o "
       "rastro depois que o caminhão saía: sem registro confiável de entregas concluídas, motivos de "
       "não entrega, horário real de chegada ou trajeto percorrido. Integrar rastreamento e roteirização "
       "melhora a eficiência das frotas (SALHIEH et al., 2021), e o comportamento real do motorista é "
       "base para rotas melhores (MESA et al., 2024).")],
    [B("Objetivo: "), N("um aplicativo para o entregador, integrado ao sistema web de roteirização, que "
                        "registre a execução em campo — inclusive sem sinal — e compare a rota planejada "
                        "com a executada.")],
], size=28)

# ===================================================== desenvolvimento

set_paragraphs(by_text("Se houve"), [
    bullet(B("App (React Native + Expo): "), N("rotas do dia, navegação pelo Google Maps, chegada, "
           "entrega e não entrega com motivo; GPS a cada 15 s ou 50 m, só com a rota ativa.")),
    bullet(B("Offline first: "), N("cada ação vai primeiro para o SQLite do aparelho e sobe por uma fila "
           "com identificador único: nada se perde, duplica ou chega fora de ordem.")),
    bullet(B("API NestJS + PostgreSQL: "), N("módulos novos para o app e para análise; planejado × "
           "executado calculado ao encerrar a rota.")),
    bullet(B("Painel Next.js: "), N("acompanhamento ao vivo e comparação da rota no mapa.")),
    bullet(B("LGPD: "), N("tela de consentimento antes da permissão de localização e política pública.")),
    [N("Os principais casos de uso estão na Figura 1.")],
], size=26)

set_text_keep(by_text("Figura 1"), "Figura 1 – Principais casos de uso")

set_paragraphs(shapes["Rectangle 1606"][1] if shapes["Rectangle 1606"][0].text_frame.text.startswith("BARBI")
               else shapes["Rectangle 1606"][0], [
    [N("Na arquitetura (Figura 2), app e painel falam com a API por HTTPS. Tudo roda em contêineres "
       "Docker numa VPS Linux, com deploy contínuo pelo GitHub Actions (sem SSH), métricas no "
       "Prometheus/Grafana e erros no Sentry.")],
], size=26)

# ---- Figura 1: casos de uso (formas nativas)
remove(shapes["Picture 155"][0])
X0, Y0 = 3.8, 48.6
box(X0 + 4.6, Y0, 13.6, 14.6, fill=None, line=CINZA, shape=MSO_SHAPE.RECTANGLE, lw=1.25)
label(X0 + 4.6, Y0 + 0.1, 13.6, 1.1, "Aplicativo", size=20, bold=True, color=VERMELHO)
box(X0 + 19.4, Y0, 13.6, 14.6, fill=None, line=CINZA, shape=MSO_SHAPE.RECTANGLE, lw=1.25)
label(X0 + 19.4, Y0 + 0.1, 13.6, 1.1, "Painel web", size=20, bold=True, color=VERMELHO)

uc_app = ["Ver rotas do dia", "Executar a rota\n(chegada, entrega)", "Registrar não entrega",
          "Sincronizar sem sinal"]
uc_web = ["Gerar rotas otimizadas", "Liberar acesso\ndo motorista", "Acompanhar ao vivo",
          "Comparar planejado\n× executado"]
ys = [Y0 + 1.5, Y0 + 4.7, Y0 + 7.9, Y0 + 11.1]
actor(X0 + 1.8, Y0 + 4.2, "Motorista")
actor(X0 + 35.0, Y0 + 4.2, "Operador")
for y, t in zip(ys, uc_app):
    box(X0 + 5.4, y, 12.0, 2.6, t, fill=ROSA, line=VERMELHO, size=20, shape=MSO_SHAPE.OVAL)
    arrow(X0 + 3.0, Y0 + 6.1, X0 + 5.4, y + 1.3, ESCURO, 1.5, head=False)
for y, t in zip(ys, uc_web):
    box(X0 + 20.2, y, 12.0, 2.6, t, fill=ROSA, line=VERMELHO, size=20, shape=MSO_SHAPE.OVAL)
    arrow(X0 + 33.8, Y0 + 6.1, X0 + 32.2, y + 1.3, ESCURO, 1.5, head=False)

# ---- Figura 2: arquitetura (formas nativas)
remove(shapes["Imagem 4"][0])
A = 3.8
box(A + 0.2, 71.4, 14.0, 3.0, "App do motorista\nExpo · SQLite offline", fill=ROSA, line=VERMELHO,
    size=22, bold=True)
box(A + 22.4, 71.4, 14.0, 3.0, "Navegador do operador\nPainel web", fill=ROSA, line=VERMELHO,
    size=22, bold=True)
vps = box(A, 75.6, 36.6, 12.6, fill=None, line=VERMELHO, shape=MSO_SHAPE.ROUNDED_RECTANGLE, lw=2.5)
vps.adjustments[0] = 0.06
label(A + 9.4, 75.7, 18, 1.0, "VPS Linux · Docker Compose", size=20, bold=True, color=VERMELHO)
box(A + 1.0, 77.0, 34.6, 1.9, "Traefik · HTTPS (Let's Encrypt)", fill=CLARO, line=CINZA, size=20,
    bold=True)
box(A + 1.0, 80.2, 10.8, 3.0, "API NestJS\n/driver · /analytics", size=22, bold=True)
box(A + 13.0, 80.2, 10.8, 3.0, "Painel Next.js\nServer Actions", size=22, bold=True)
box(A + 25.0, 80.2, 10.6, 3.0, "Prometheus\n+ Grafana", size=22, bold=True)
box(A + 1.0, 84.6, 10.8, 2.9, "PostgreSQL 17", size=22, bold=True, shape=MSO_SHAPE.CAN)
box(A + 13.0, 84.6, 22.6, 2.9, "Staging e produção lado a lado · backup diário", fill=None,
    line=None, size=20, color=CINZA, shape=MSO_SHAPE.RECTANGLE)
box(A + 0.2, 89.4, 11.2, 2.8, "Google Maps\nRoute Optimization", fill=BRANCO, size=20, bold=True)
box(A + 12.7, 89.4, 11.2, 2.8, "GitHub Actions\nCI/CD · SonarCloud", fill=BRANCO, size=20, bold=True)
box(A + 25.2, 89.4, 11.2, 2.8, "Sentry\nerros", fill=BRANCO, size=20, bold=True)
# setas
arrow(A + 7.2, 74.4, A + 7.2, 77.0, VERMELHO)          # app -> traefik
arrow(A + 29.4, 74.4, A + 29.4, 77.0, VERMELHO)        # navegador -> traefik
arrow(A + 6.4, 78.9, A + 6.4, 80.2)                    # traefik -> api
arrow(A + 18.4, 78.9, A + 18.4, 80.2)                  # traefik -> painel
arrow(A + 13.0, 81.7, A + 11.8, 81.7)                  # painel -> api
arrow(A + 30.3, 83.2, A + 30.3, 83.9, head=False, dashed=True)  # prometheus -> api (/metrics)
arrow(A + 30.3, 83.9, A + 10.4, 83.9, head=False, dashed=True)
arrow(A + 10.4, 83.9, A + 10.4, 83.2, dashed=True)
arrow(A + 6.4, 83.2, A + 6.4, 84.6)                    # api -> postgres
arrow(A + 5.8, 88.2, A + 5.8, 89.4)                    # api -> google
arrow(A + 18.3, 89.4, A + 18.3, 88.2)                  # github -> vps (runner)
arrow(A + 30.8, 88.2, A + 30.8, 89.4)                  # vps -> sentry

# ===================================================== resultados

set_paragraphs(by_text("Aqui insira"), [
    bullet(B("v1.0.1 em produção: "), N("APK, painel e API com HTTPS, em ambientes de staging e produção.")),
    bullet(B("Qualidade: "), N("CI em todo commit (lint, tipos, testes e SonarCloud). Backend com 221 "
           "testes (80,8% de cobertura), painel com 136 e app com 46, focados na fila offline e no "
           "cálculo planejado × executado.")),
    bullet(B("Piloto na Forte: "), H("[N] rotas reais, [N] paradas, [X]% registradas com horário e motivo, "
           "[N] ações feitas sem sinal — preencher após o piloto.")),
    [N("A Figura 3 mostra uma parada no app e o painel de indicadores (dados de demonstração).")],
], size=26)

set_text_keep(by_text("Figura 3"), "Figura 3 – App do motorista e painel de indicadores")

remove(shapes["Picture 159"][0])
slide.shapes.add_picture("app-parada.jpg", Cm(42.4), Cm(30.4), height=Cm(17.0))
slide.shapes.add_picture("painel-indicadores.jpg", Cm(50.8), Cm(31.4), width=Cm(25.4))

set_paragraphs(by_text("Lorem ipsum tempus quam proin ligula fames pulvinar, sodales taciti mi tempus ligula potenti, interdum dolor iaculis tellus gravida auctor. sapien habitasse litora a accumsan viverra adipiscing eros donec, urna aenean tempus lacinia elit vulputate vel consequat, primis sagittis maecenas magna suspendisse porttitor magna, Figura 4"), [
    [N("Por rota, o painel compara distância e duração planejadas × reais, atraso na chegada, paradas "
       "fora de ordem e tempo ocioso. A Figura 4 leva ao aplicativo e à documentação.")],
], size=26)

set_text_keep(by_text("Figura 4"), "Figura 4 – QR Codes: aplicativo e documentação")
remove(shapes["Imagem 2"][0])
slide.shapes.add_picture("qr-apk.png", Cm(45.4), Cm(55.6), width=Cm(10.0))
slide.shapes.add_picture("qr-wiki.png", Cm(62.4), Cm(55.6), width=Cm(10.0))
label(43.4, 65.6, 14.0, 1.0, "Baixar o app (APK)", size=20, bold=True)
label(60.4, 65.6, 14.0, 1.0, "Documentação e painel", size=20, bold=True)

# ===================================================== conclusões e referências

set_paragraphs(by_text("Relembre"), [
    [N("O Athonis fechou o ciclo entre planejar e executar: o motorista registra cada entrega, com ou "
       "sem sinal, e a empresa passa a medir a qualidade das rotas. A principal lição foi tratar a "
       "conectividade como requisito desde o início. Próximo passo: usar o histórico de execução "
       "como entrada da otimização.")],
], size=26)

refs = by_text("BARBI")
set_paragraphs(refs, [
    "BRASIL. Lei nº 13.709, de 14 ago. 2018. Lei Geral de Proteção de Dados Pessoais (LGPD).",
    "BROWN, S. The C4 model for visualising software architecture. Disponível em: c4model.com.",
    "MESA, J. P. et al. A bi-objective approach to last-mile delivery routing considering driver "
    "preferences. arXiv:2405.16051, 2024.",
    "RAHMAN, M. A. et al. Intelligent vehicle scheduling and routing for a chain of retail stores: "
    "a case study of Dhaka, Bangladesh. Logistics, v. 5, n. 3, p. 63, 2021.",
    "SALHIEH, L. et al. Integrating vehicle tracking and routing systems in retail distribution "
    "management. Int. J. of Retail & Distribution Management, v. 49, n. 8, p. 1154–1177, 2021.",
    "Repositórios: github.com/kevin-elazar/AthonisMobile · AthonisBackend · athonis-front-end",
], size=20)

prs.save(OUT)
print("salvo", OUT)
