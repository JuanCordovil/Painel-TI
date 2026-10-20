import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

const STATUS: Record<number, string> = {
  1: 'Novo',
  2: 'Em atendimento',
  3: 'Planejado',
  4: 'Pendente',
};

export interface Chamado {
  id: number;
  titulo: string;
  status: string;
  tecnico: string;
  requerente: string;
  entidade: string;
  localizacao: string;
}

@Injectable({ providedIn: 'root' })
export class Glpi {
  private readonly http = inject(HttpClient);
  private sessionToken?: string;

  private obterToken() {
    if (this.sessionToken) {
      return of(this.sessionToken);
    }
    return this.iniciarSessao().pipe(
      map(s => s.session_token),
      tap(token => (this.sessionToken = token)),
    );
  }

  // Executa a chamada com o token guardado; se a sessão expirou (401), abre outra e repete.
  private comSessao<T>(chamada: (token: string) => Observable<T>): Observable<T> {
    return this.obterToken().pipe(
      switchMap(chamada),
      catchError(err => {
        if (err.status !== 401) {
          return throwError(() => err);
        }
        this.sessionToken = undefined;
        return this.obterToken().pipe(switchMap(chamada));
      }),
    );
  }

  iniciarSessao() {
    return this.http.get<{ session_token: string }>('/glpi/apirest.php/initSession');
  }

  listarChamados() {
    return this.comSessao(token => this.http.get<{ data: any[] }>('/glpi/apirest.php/search/Ticket', {
    headers: { 'Session-Token': token },
    params: {
      'criteria[0][field]': 12,
      'criteria[0][searchtype]': 'equals',
      'criteria[0][value]': 'notold',
      expand_dropdowns: true,
      range: '0-99',
      sort: 2,
      order: 'DESC',
      'forcedisplay[0]': 2,
      'forcedisplay[1]': 12,
      'forcedisplay[2]': 1,
      'forcedisplay[3]': 5,
      'forcedisplay[4]': 4,
      'forcedisplay[5]': 80,
      'forcedisplay[6]': 83,
    },
  })).pipe(
      map(r => r.data.map(t => ({
        id: t[2],
        titulo: t[1],
        status: STATUS[t[12]] ?? t[12],
        tecnico: t[5],
        requerente: t[4],
        entidade: t[80],
        localizacao: t[83],
      } as Chamado)))
    );
  }
  listarUsuarios() {
    return this.comSessao(token => this.http.get<any[]>('/glpi/apirest.php/User', {
      headers: { 'Session-Token': token },
      params: { range: '0-1999' },
    }));
  }

  // Conta os chamados em que QUALQUER um dos campos de data (15 = abertura,
  // 16 = fechamento, 17 = solução) é de hoje em diante.
  private contarDesdeHoje(campos: number[]) {
    const hoje = new Date().toLocaleDateString('sv-SE'); // formato AAAA-MM-DD
    const params: Record<string, string | number> = { range: '0-0' }; // só interessa o total
    campos.forEach((campo, i) => {
      if (i > 0) {
        params[`criteria[${i}][link]`] = 'OR';
      }
      params[`criteria[${i}][field]`] = campo;
      params[`criteria[${i}][searchtype]`] = 'morethan';
      params[`criteria[${i}][value]`] = `${hoje} 00:00:00`;
    });
    return this.comSessao(token => this.http.get<{ totalcount: number }>('/glpi/apirest.php/search/Ticket', {
      headers: { 'Session-Token': token },
      params,
    })).pipe(
      map(r => r.totalcount ?? 0)
    );
  }

  contarAbertosHoje() {
    return this.contarDesdeHoje([15]);
  }

  // Solucionados e fechados hoje: vale a data de solução ou a de fechamento.
  contarFechadosHoje() {
    return this.contarDesdeHoje([17, 16]);
  }
}
