import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Chamado, Glpi } from './glpi';

// Parte do nome da voz desejada (ex.: 'Francisca', 'Antonio', 'Maria'); vazio usa a primeira voz pt.
// Para listar as disponíveis: speechSynthesis.getVoices() no console do navegador.
const VOZ_PREFERIDA = 'Maria';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('painel-ti');
  protected readonly chamados = signal<Chamado[]>([]);
  protected readonly abertosHoje = signal(0);
  protected readonly fechadosHoje = signal(0);
  private readonly glpi = inject(Glpi);
  private nomes: Record<string, string> = {};
  private idsConhecidos?: Set<number>;

  constructor() {
    this.carregarUsuarios();
    setInterval(() => this.atualizarChamados(), 60_000);
    setInterval(() => this.carregarUsuarios(), 3_600_000);
  }

  carregarUsuarios() {
    this.glpi.listarUsuarios().subscribe(usuarios => {
      const nomes: Record<string, string> = {};
      for (const u of usuarios) {
        const completo = `${u.firstname ?? ''} ${u.realname ?? ''}`.trim();
        nomes[u.id] = completo || u.name.replace('.', ' ');
      }
      this.nomes = nomes;
      this.atualizarChamados();
    });
  }

  // Com mais de um usuário no campo o GLPI devolve lista (ou "810,842"); resolve cada id para o nome.
  private resolverNomes(valor: unknown): string {
    const ids = Array.isArray(valor) ? valor : String(valor ?? '').split(',');
    return ids
      .map(id => String(id).trim())
      .filter(id => id !== '')
      .map(id => this.nomes[id] ?? id)
      .join(', ');
  }

  // Fala em voz alta na TV; só dispara depois da primeira carga, para não anunciar o que já existia.
  private anunciarNovos(chamados: Chamado[]) {
    const ids = new Set(chamados.map(c => c.id));
    if (this.idsConhecidos) {
      const novos = [...ids].filter(id => !this.idsConhecidos!.has(id)).length;
      if (novos > 0) {
        const fala = new SpeechSynthesisUtterance(novos === 1 ? 'Novo chamado' : `${novos} novos chamados`);
        fala.lang = 'pt-BR';
        const voz = speechSynthesis.getVoices().find(v => v.lang.startsWith('pt') && v.name.includes(VOZ_PREFERIDA));
        if (voz) {
          fala.voice = voz;
        }
        speechSynthesis.speak(fala);
      }
    }
    this.idsConhecidos = ids;
  }

  atualizarChamados() {
    this.glpi.listarChamados().subscribe(chamados => {
      this.anunciarNovos(chamados);
      this.chamados.set(
        chamados.map(c => ({
          ...c,
          tecnico: this.resolverNomes(c.tecnico),
          requerente: this.resolverNomes(c.requerente),
        })),
      );
    });
    this.glpi.contarAbertosHoje().subscribe(n => this.abertosHoje.set(n));
    this.glpi.contarFechadosHoje().subscribe(n => this.fechadosHoje.set(n));
  }
}
