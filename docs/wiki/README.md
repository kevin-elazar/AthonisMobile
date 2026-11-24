# Fonte da Wiki

Estes arquivos são a fonte da [Wiki do projeto](https://github.com/kevin-elazar/AthonisMobile/wiki). Edite aqui (com revisão por PR) e publique:

```bash
git clone https://github.com/kevin-elazar/AthonisMobile.wiki.git /tmp/athonis-wiki
cp docs/wiki/*.md /tmp/athonis-wiki/ && rm /tmp/athonis-wiki/README.md
cd /tmp/athonis-wiki && git add -A && git commit -m "docs: atualiza a wiki" && git push
```

Os diagramas são Mermaid, renderizados pelo próprio GitHub.
