/*
  Warnings:

  - Added the required column `fieldName` to the `FieldSuggestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fieldType` to the `FieldSuggestion` table without a default value. This is not possible if the table is not empty.

*/
-- FieldSuggestion est un cache dérivé (rejouable via `npm run fields:refresh`), sans
-- fieldName/fieldType récupérables depuis le seul fieldKey (hash) existant : on vide la
-- table plutôt que d'inventer des valeurs, elle sera repeuplée avec les nouvelles colonnes
-- au prochain import de spec ou prochain `fields:refresh`.
TRUNCATE TABLE "FieldSuggestion";

-- AlterTable
ALTER TABLE "FieldSuggestion" ADD COLUMN     "fieldName" TEXT NOT NULL,
ADD COLUMN     "fieldType" TEXT NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'gemini';
