"""
Gera a marca do Athonis Entregas e todos os ícones do app a partir de um só
desenho: um "A" feito de rota (duas pernas de estrada, travessa tracejada e
paradas nas bases, com o pino de localização no topo).

Uso (na raiz do AthonisMobile):  python assets/brand/gerar_marca.py
Saída: assets/images/*.png (ícone, ícone adaptativo do Android, splash,
favicon) e assets/images/logo-mark.png (logo da tela de login).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "assets" / "images"

AZUL = (47, 93, 227)  # --primary do painel (#2F5DE3)
AZUL_ESCURO = (31, 58, 156)  # --primary-active (#1F3A9C)
BRANCO = (255, 255, 255)
SS = 4  # supersampling para bordas lisas


def gradiente(tamanho: int) -> Image.Image:
    """Fundo azul em diagonal, do primário ao primário escuro."""
    base = Image.new("RGB", (tamanho, tamanho), AZUL)
    px = base.load()
    for y in range(tamanho):
        for x in range(tamanho):
            t = (x + y) / (2 * (tamanho - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(AZUL, AZUL_ESCURO))
    return base


def marca(tamanho: int, cor=BRANCO, escala: float = 1.0, miolo=AZUL) -> Image.Image:
    """O "A" de rota, transparente, centralizado num quadrado de `tamanho` px.

    `miolo` é a cor do centro das paradas; None deixa o centro vazado (ícone
    monocromático do Android, que só usa a transparência).
    """
    s = tamanho * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(x: float, y: float) -> tuple[float, float]:
        # Coordenadas num quadro 100x100, reduzidas pela escala em torno do centro.
        return (50 + (x - 50) * escala) * s / 100, (50 + (y - 50) * escala) * s / 100

    u = escala * s / 100  # 1 unidade do quadro, em pixels
    topo, base_esq, base_dir = p(50, 17), p(23, 78), p(77, 78)

    def circulo(c, r, fill):
        d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill)

    # Pernas do A: a estrada, com o topo arredondado.
    largura = 10 * u
    d.line([base_esq, topo, base_dir], fill=cor, width=round(largura), joint="curve")
    circulo(topo, largura / 2, cor)

    # Travessa: três pontos, o trecho planejado entre as paradas.
    for x in (42, 50, 58):
        circulo(p(x, 59), 2.7 * u, cor)

    # Paradas nas bases: ponto de rota com miolo.
    for base in (base_esq, base_dir):
        circulo(base, 9 * u, cor)
        if miolo is not None:
            circulo(base, 3.8 * u, miolo)

    if miolo is None:
        # Vaza o miolo das paradas (só a transparência importa no monocromático).
        furo = Image.new("L", (s, s), 0)
        fd = ImageDraw.Draw(furo)
        for base in (base_esq, base_dir):
            fd.ellipse([base[0] - 3.8 * u, base[1] - 3.8 * u, base[0] + 3.8 * u, base[1] + 3.8 * u], fill=255)
        alfa = img.getchannel("A")
        alfa.paste(0, mask=furo)
        img.putalpha(alfa)

    return img.resize((tamanho, tamanho), Image.LANCZOS)


def arredondar(img: Image.Image, raio: float) -> Image.Image:
    s = img.width * SS
    mascara = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, s - 1, s - 1], radius=raio * s, fill=255)
    mascara = mascara.resize(img.size, Image.LANCZOS)
    out = img.convert("RGBA")
    out.putalpha(mascara)
    return out


def com_sombra(fundo: Image.Image, desenho: Image.Image) -> Image.Image:
    sombra = Image.new("RGBA", desenho.size, (0, 0, 0, 0))
    sombra.putalpha(desenho.getchannel("A").point(lambda a: int(a * 0.28)))
    sombra = sombra.filter(ImageFilter.GaussianBlur(desenho.width / 90))
    out = fundo.convert("RGBA")
    out.alpha_composite(sombra, (0, round(desenho.width / 120)))
    out.alpha_composite(desenho)
    return out


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)

    # Ícone (iOS e lojas): fundo cheio, a marca ocupando ~60%.
    com_sombra(gradiente(1024), marca(1024, escala=0.82)).convert("RGB").save(SAIDA / "icon.png")

    # Android adaptativo: o sistema recorta um círculo/squircle de ~66% do centro.
    gradiente(512).save(SAIDA / "android-icon-background.png")
    marca(512, escala=0.62, miolo=AZUL_ESCURO).save(SAIDA / "android-icon-foreground.png")
    marca(512, escala=0.62, miolo=None).save(SAIDA / "android-icon-monochrome.png")

    # Splash: marca branca sobre o azul do app.json.
    marca(512, escala=0.9, miolo=None).save(SAIDA / "splash-icon.png")

    # Logo da tela de login: azul arredondado com a marca.
    arredondar(com_sombra(gradiente(512), marca(512, escala=0.78)), 0.24).save(SAIDA / "logo-mark.png")

    # Favicon do app web.
    arredondar(gradiente(64).convert("RGBA"), 0.24).save(SAIDA / "favicon.png")
    fav = arredondar(com_sombra(gradiente(256), marca(256, escala=0.8)), 0.24).resize((64, 64), Image.LANCZOS)
    fav.save(SAIDA / "favicon.png")
    print("Ícones gerados em", SAIDA)


if __name__ == "__main__":
    main()
