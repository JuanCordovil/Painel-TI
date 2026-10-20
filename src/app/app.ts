import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Chamado, Glpi } from './glpi';

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

  atualizarChamados() {
    this.glpi.listarChamados().subscribe(chamados => {
      this.chamados.set(
        chamados.map(c => ({
          ...c,
          tecnico: this.nomes[c.tecnico] ?? c.tecnico,
          requerente: this.nomes[c.requerente] ?? c.requerente,
        })),
      );
    });
    this.glpi.contarAbertosHoje().subscribe(n => this.abertosHoje.set(n));
    this.glpi.contarFechadosHoje().subscribe(n => this.fechadosHoje.set(n));
  }
}
