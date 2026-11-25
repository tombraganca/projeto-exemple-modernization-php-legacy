import {
  Controller,
  Get,
  type INestApplication,
  Version,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ContatoRepository } from '../../src/modules/contatos/application/contato.repository.js';
import { KyselyContatoRepository } from '../../src/modules/contatos/infrastructure/kysely-contato.repository.js';
import { dadosValidos } from '../support/contato.fixture.js';
import {
  createTempDir,
  openRaw,
  removeTempDir,
  tempDatabasePath,
  testSettings,
} from '../support/temp-database.js';

/** Controllers só de teste: provam o prefixo e o versionamento neutro sem criar rota de produção. */
@Controller('sonda')
class SondaController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Controller('sonda-v2')
class SondaV2Controller {
  @Version('2')
  @Get()
  get(): { versao: 2 } {
    return { versao: 2 };
  }
}

describe('Composição da aplicação e configureApp', () => {
  let dir: string;
  let path: string;
  let app: INestApplication;

  async function criarApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(testSettings(path))],
      controllers: [SondaController, SondaV2Controller],
    }).compile();
    const nova = configureApp(
      moduleRef.createNestApplication({ logger: false }),
    );
    await nova.init();
    return nova;
  }

  beforeEach(async () => {
    dir = createTempDir();
    path = tempDatabasePath(dir);
    app = await criarApp();
  });

  afterEach(async () => {
    await app?.close();
    removeTempDir(dir);
  });

  it('controller sem @Version responde em /api/<rota>', async () => {
    await request(app.getHttpServer())
      .get('/api/sonda')
      .expect(200, { ok: true });
  });

  it('sem o prefixo ou com /v1 não responde', async () => {
    await request(app.getHttpServer()).get('/sonda').expect(404);
    await request(app.getHttpServer()).get('/api/v1/sonda').expect(404);
  });

  it('@Version("2") responde em /api/v2/<rota>', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/sonda-v2')
      .expect(200, { versao: 2 });
    await request(app.getHttpServer()).get('/api/sonda-v2').expect(404);
  });

  it('ContatoRepository resolve para o adapter Kysely e usa o banco migrado', async () => {
    const repo = app.get(ContatoRepository);
    expect(repo).toBeInstanceOf(KyselyContatoRepository);
    const gravado = await repo.inserir(dadosValidos());
    expect(await repo.obterPorId(gravado.id)).toEqual(gravado);
  });

  it('app.close() fecha o banco e o mesmo arquivo reabre com os dados', async () => {
    const gravado = await app.get(ContatoRepository).inserir(dadosValidos());

    await app.close();
    const raw = openRaw(path);
    expect(
      raw.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM contato').get()
        ?.n,
    ).toBe(1);
    raw.close();

    app = await criarApp();
    expect(await app.get(ContatoRepository).obterPorId(gravado.id)).toEqual(
      gravado,
    );
  });
});
