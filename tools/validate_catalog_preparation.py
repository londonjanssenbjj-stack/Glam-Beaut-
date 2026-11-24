#!/usr/bin/env python3
"""Read-only preflight for Glam Beaut product/variant reconciliation CSV.
No database access and no writes. Run: python3 tools/validate_catalog_preparation.py [csv-path]
"""
import csv
import sys
from pathlib import Path

DEFAULT = Path("catalogo/PLANILHA_PREPARACAO_CADASTRO_VARIANTES_16_PRODUTOS.csv")
EXPECTED = {"product_id", "nome", "categoria", "preco_brl", "sku_proposto",
             "descricao_variante_pendente", "quantidade_confirmada",
             "status_cadastro", "ativar"}

def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not path.exists():
        print(f"ERRO: arquivo não encontrado: {path}")
        return 2
    with path.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        print("ERRO: CSV sem linhas.")
        return 2
    errors, warnings = [], []
    missing = EXPECTED - set(rows[0].keys())
    if missing:
        errors.append("Colunas ausentes: " + ", ".join(sorted(missing)))
    ids = [r.get("product_id", "").strip() for r in rows]
    skus = [r.get("sku_proposto", "").strip() for r in rows]
    if any(not x for x in ids): errors.append("Há product_id vazio.")
    if len(ids) != len(set(ids)): errors.append("product_id duplicado.")
    if any(not x for x in skus): errors.append("Há SKU proposto vazio.")
    if len(skus) != len(set(skus)): errors.append("SKU proposto duplicado.")
    for n, row in enumerate(rows, start=2):
        price = row.get("preco_brl", "").strip()
        try:
            if float(price) < 0: errors.append(f"Linha {n}: preço negativo.")
        except ValueError: errors.append(f"Linha {n}: preço inválido.")
        if row.get("ativar", "").strip().upper() != "FALSE":
            errors.append(f"Linha {n}: ativar deve permanecer FALSE.")
        if row.get("quantidade_confirmada", "").strip():
            warnings.append(f"Linha {n}: quantidade preenchida; conferir contagem física e evidência.")
        if not row.get("descricao_variante_pendente", "").strip():
            warnings.append(f"Linha {n}: variante não documentada.")
    print(f"Arquivo: {path}\nLinhas: {len(rows)}")
    print(f"IDs únicos: {len(set(ids))}/{len(ids)} | SKUs únicos: {len(set(skus))}/{len(skus)}")
    for w in warnings: print("AVISO:", w)
    for e in errors: print("ERRO:", e)
    if errors:
        print("RESULTADO: REPROVADO — corrigir antes de importar.")
        return 1
    print("RESULTADO: APROVADO NA VALIDAÇÃO ESTRUTURAL (não valida fotos, estoque, banco ou variantes físicas).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
