import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataService } from '../mock-data/mock-data.service';
import { SpecificationService } from '../specification/specification.service';
import { collectWeakFields } from '../mock-data/weak-field-collector';
import { suggestFieldValues } from '../mock-data/gemini-field-suggester';

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
