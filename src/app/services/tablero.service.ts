import { Injectable, NgZone, inject } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  Database,
  ref,
  set,
  get,
  child,
  update,
  onValue,
  off,
  Unsubscribe,
} from 'firebase/database';
import { Observable } from 'rxjs';
import { Papel, RankingEntry } from '../models/papel.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TableroService {
  private app: FirebaseApp;
  private db: Database;

  private readonly TOTAL_PAPELES = 60;
  private readonly PREMIOS: number[] = [
    ...Array(1).fill(50),
    ...Array(5).fill(20),
    ...Array(15).fill(10),
    ...Array(39).fill(0),
  ];

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getDatabase(this.app);
  }

  getTablero(): Observable<Record<string, Papel>> {
    return new Observable<Record<string, Papel>>((observer) => {
      const tableroRef = ref(this.db, 'tablero');
      const callback = (snapshot: any) => {
        observer.next(snapshot.val() ?? {});
      };
      onValue(tableroRef, callback);
      return () => off(tableroRef, 'value', callback);
    });
  }

  getRanking(): Observable<RankingEntry[]> {
    return new Observable<RankingEntry[]>((observer) => {
      const rankingRef = ref(this.db, 'ranking');
      const callback = (snapshot: any) => {
        const data = snapshot.val();
        if (!data) {
          observer.next([]);
          return;
        }
        const list = Object.values(data as Record<string, RankingEntry>)
          .filter((e: RankingEntry) => e.nombre)
          .sort((a: RankingEntry, b: RankingEntry) => b.total_ganado - a.total_ganado);
        observer.next(list);
      };
      onValue(rankingRef, callback);
      return () => off(rankingRef, 'value', callback);
    });
  }

  async initTablero(): Promise<void> {
    const mezclado = this.fisherYates([...this.PREMIOS]);
    const tableroData: Record<string, Papel> = {};
    for (let i = 0; i < this.TOTAL_PAPELES; i++) {
      const key = `papel_${i + 1}`;
      tableroData[key] = {
        numero: i + 1,
        premio: mezclado[i],
        revelado: false,
        ganador: '',
      };
    }
    const rankingRef = ref(this.db, 'ranking');
    const tableroRef = ref(this.db, 'tablero');
    await Promise.all([set(tableroRef, tableroData), set(rankingRef, {})]);
  }

  async revelarPapel(papelId: string, ganador: string): Promise<Papel | null> {
    const papelRef = ref(this.db, `tablero/${papelId}`);
    const snapshot = await get(papelRef);
    if (!snapshot.exists()) return null;

    const papel = snapshot.val() as Papel;
    if (papel.revelado) return null;

    await update(papelRef, { revelado: true, ganador });

    const rankingRef = ref(this.db, `ranking/${ganador}`);
    const rankingSnap = await get(rankingRef);
    const prevTotal = rankingSnap.exists() ? rankingSnap.val().total_ganado : 0;

    await set(rankingRef, {
      nombre: ganador,
      total_ganado: prevTotal + papel.premio,
    });

    return papel;
  }

  async editarRanking(nombre: string, nuevoTotal: number): Promise<void> {
    const r = ref(this.db, `ranking/${nombre}`);
    if (nuevoTotal <= 0) {
      await set(r, null);
    } else {
      await set(r, { nombre, total_ganado: nuevoTotal });
    }
  }

  async resetJuego(): Promise<void> {
    await this.initTablero();
  }

  getPremioLabel(premio: number): string {
    if (premio === 0) return '¡Vacío, asere!';
    if (premio === 50) return '🔥 PREMIO MAYOR $50 🔥';
    return `$${premio}`;
  }

  private fisherYates(arr: number[]): number[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
