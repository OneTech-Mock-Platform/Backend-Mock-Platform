import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataService } from '../mock-data/mock-data.service';
import { SpecificationService } from '../specification/specification.service';
import { collectWeakFields } from '../mock-data/weak-field-collector';
import { suggestFieldValues } from '../mock-data/gemini-field-suggester';

// Script à lancer via `npm run fields:refresh` — UNE SEULE FOIS, pour rattraper toutes les
// specs déjà importées avant que ce système existe. Les futures specs n'en ont plus besoin :
// SpecificationService.create()/update() font déjà collecte → Gemini → cache → reload dans
// le bon ordre, avant de générer leurs scénarios.
//
// Ici, en plus, on régénère (patch ciblé, pas d'écrasement) les scénarios déjà en base pour
// qu'ils profitent immédiatement des nouvelles suggestions.
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const mockDataService = app.get(MockDataService);
    const specificationService = app.get(SpecificationService);

    console.log('[fields:refresh] Collecte des champs faibles sur toutes les specs...');
    const weakFields = await collectWeakFields(prisma);
    console.log(`[fields:refresh] ${weakFields.length} champ(s) unique(s) trouvé(s).`);

    const uncached = weakFields.filter((f) => !mockDataService.hasSuggestion(f.id));
    console.log(
      `[fields:refresh] ${weakFields.length - uncached.length} déjà en cache, ${uncached.length} à demander à Gemini.`,
    );

    if (uncached.length > 0) {
      const suggestions = await suggestFieldValues(uncached);

      let created = 0;
      for (const field of uncached) {
        if (!Object.prototype.hasOwnProperty.call(suggestions, field.id)) continue;
        await prisma.fieldSuggestion.upsert({
          where: { fieldKey: field.id },
          create: {
            fieldKey: field.id,
            fieldName: field.name,
            fieldType: field.type,
            value: suggestions[field.id] as any,
            source: 'gemini',
          },
          update: { value: suggestions[field.id] as any },
        });
        created += 1;
      }
      console.log(`[fields:refresh] ${created} nouvelle(s) suggestion(s) enregistrée(s) dans FieldSuggestion.`);

      // Étape critique : recharger le cache en mémoire AVANT de régénérer les scénarios,
      // sinon regenerateScenarios() tournerait encore avec l'ancien cache (vide/partiel).
      await mockDataService.reloadSuggestionCache();
    } else {
      console.log('[fields:refresh] Tous les champs faibles sont déjà en cache. Aucun appel Gemini.');
    }

    console.log('[fields:refresh] Régénération des scénarios existants (patch ciblé, éditions manuelles préservées)...');
    const specs = await prisma.openApiSpec.findMany();
    let totalPatched = 0;
    for (const spec of specs) {
      const patched = await specificationService.regenerateScenarios(spec.id);
      totalPatched += patched;
      if (patched > 0) {
        console.log(`[fields:refresh]   - "${spec.name}" (${spec.id}) : ${patched} scénario(s) mis à jour.`);
      }
    }
    console.log(`[fields:refresh] Terminé. ${totalPatched} scénario(s) mis à jour au total sur ${specs.length} spec(s).`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[fields:refresh] Échec :', err);
  process.exitCode = 1;
});
