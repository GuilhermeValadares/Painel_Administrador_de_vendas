-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Pagamento" AS ENUM ('PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'PENDENTE');

-- CreateEnum
CREATE TYPE "Cartao" AS ENUM ('VISA', 'MASTER', 'ELO', 'OUTRO');

-- CreateEnum
CREATE TYPE "Entrega" AS ENUM ('NA_HORA', 'BUSCOU', 'CORREIOS', 'MOTOBOY');

-- CreateEnum
CREATE TYPE "Tipo" AS ENUM ('VENDA', 'DEVOLUCAO');

-- CreateEnum
CREATE TYPE "Origem" AS ENUM ('DIGITADA', 'IMPORTADA');

-- CreateTable
CREATE TABLE "vendas" (
    "id" UUID NOT NULL,
    "dono_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "produto" TEXT NOT NULL,
    "cliente" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "pagamento" "Pagamento" NOT NULL,
    "cartao" "Cartao",
    "parcelas" INTEGER,
    "entrega" "Entrega" NOT NULL,
    "rastreio" TEXT,
    "observacao" TEXT,
    "tipo" "Tipo" NOT NULL DEFAULT 'VENDA',
    "origem" "Origem" NOT NULL DEFAULT 'DIGITADA',
    "texto_original" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterada_em" TIMESTAMP(3) NOT NULL,
    "apagada_em" TIMESTAMP(3),

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendas_dono_id_data_idx" ON "vendas"("dono_id", "data");



-- Segunda barreira: mesmo que alguém use a API do Supabase direto, cada conta só enxerga as próprias vendas.
-- O Prisma conecta como dono do banco e não passa por aqui; por isso o código também filtra por dono_id.
ALTER TABLE "vendas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_do_dono" ON "vendas"
  FOR ALL TO authenticated
  USING (dono_id = (SELECT auth.uid()))
  WITH CHECK (dono_id = (SELECT auth.uid()));
