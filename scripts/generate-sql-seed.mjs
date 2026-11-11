import fs from "node:fs";
import path from "node:path";
import { CATEGORIAS_NUCLEARES, SETORES } from "../src/domain/taxonomy.mjs";

const esc = (s) => s.replace(/'/g, "''");

let sql = `-- ============================================================================
-- SEED 002: POPULAÇÃO DA MATRIZ COMPLETA (14 SETORES x 6 CATEGORIAS)
-- 22 Opções Nucleares Globais (is_global = TRUE) + 102 Opções Específicas
-- ============================================================================

-- 1. Inserindo as 6 Categorias Nucleares (Toque 1)
INSERT INTO categorias_nucleares (id, nome) VALUES
`;

sql += CATEGORIAS_NUCLEARES.map(c => `  (${c.id}, '${esc(c.nome)}')`).join(",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n";

sql += `-- 2. Inserindo os 14 Setores Operacionais\nINSERT INTO setores (id, nome) VALUES\n`;
sql += SETORES.map(s => `  (${s.id}, '${esc(s.nome)}')`).join(",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n";

sql += `-- 3. Inserindo os 22 Tipos de Ocorrência Nucleares Fixos (is_global = TRUE, setor_id = NULL)\nINSERT INTO tipos_ocorrencia (categoria_id, setor_id, titulo, is_global) VALUES\n`;
const nuclearRows = [];
for (const cat of CATEGORIAS_NUCLEARES) {
  for (const nuc of cat.nucleares) {
    nuclearRows.push(`  (${cat.id}, NULL, '${esc(nuc)}', TRUE)`);
  }
}
sql += nuclearRows.join(",\n") + ";\n\n";

sql += `-- 4. Inserindo os 102 Tipos de Ocorrência Específicos por Setor (is_global = FALSE)\nINSERT INTO tipos_ocorrencia (categoria_id, setor_id, titulo, is_global) VALUES\n`;
const specificRows = [];
for (const setor of SETORES) {
  for (const cat of CATEGORIAS_NUCLEARES) {
    const esps = setor.especificos[cat.id] || [];
    for (const esp of esps) {
      specificRows.push(`  (${cat.id}, ${setor.id}, '${esc(esp)}', FALSE)`);
    }
  }
}
sql += specificRows.join(",\n") + ";\n";

const targetPath = path.resolve("database/seeds/002_seed_matriz_14_setores.sql");
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, sql, "utf8");
console.log(`Generated ${targetPath} with ${nuclearRows.length} nuclear and ${specificRows.length} specific items.`);
