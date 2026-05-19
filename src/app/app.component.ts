import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { AsyncPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableroService } from './services/tablero.service';
import { Papel, RankingEntry } from './models/papel.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, KeyValuePipe, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private tableroService = inject(TableroService);

  tablero$ = this.tableroService.getTablero();
  ranking$ = this.tableroService.getRanking();

  papelSeleccionado = signal<Papel | null>(null);
  papelIdSeleccionado = signal<string>('');
  ganadorNombre = signal('');
  mostrandoModal = signal(false);
  mostrandoAdmin = signal(false);
  revelandoId = signal<string | null>(null);
  errorMsg = signal('');
  editandoRanking = signal<{ nombre: string; total_ganado: number } | null>(null);
  editValor = signal(0);

  celebracion = signal<{ nombre: string; premio: number } | null>(null);
  loading = signal(true);

  ngOnInit() {
    this.tablero$.subscribe(async (data) => {
      if (!data || Object.keys(data).length === 0) {
        await this.tableroService.initTablero();
      }
      this.loading.set(false);
    });
  }

  abrirModal(papelId: string, papel: Papel) {
    if (papel.revelado) return;
    this.papelSeleccionado.set(papel);
    this.papelIdSeleccionado.set(papelId);
    this.ganadorNombre.set('');
    this.errorMsg.set('');
    this.mostrandoModal.set(true);
  }

  cerrarModal() {
    this.mostrandoModal.set(false);
    this.papelSeleccionado.set(null);
    this.ganadorNombre.set('');
    this.errorMsg.set('');
  }

  async confirmarRevelar() {
    const nombre = this.ganadorNombre().trim();
    if (!nombre) {
      this.errorMsg.set('Escribe el nombre del participante');
      return;
    }
    this.errorMsg.set('');
    this.revelandoId.set(this.papelIdSeleccionado());
    const papel = await this.tableroService.revelarPapel(this.papelIdSeleccionado(), nombre);
    this.revelandoId.set(null);
    this.cerrarModal();
    if (papel) {
      this.celebracion.set({ nombre, premio: papel.premio });
      setTimeout(() => this.celebracion.set(null), 4500);
    }
  }

  toggleAdmin() {
    this.mostrandoAdmin.update((v) => !v);
  }

  iniciarEdicionRanking(entry: RankingEntry) {
    this.editandoRanking.set({ nombre: entry.nombre, total_ganado: entry.total_ganado });
    this.editValor.set(entry.total_ganado);
  }

  async guardarEdicionRanking() {
    const e = this.editandoRanking();
    if (!e) return;
    await this.tableroService.editarRanking(e.nombre, this.editValor());
    this.editandoRanking.set(null);
  }

  async resetJuego() {
    if (!confirm('¿Seguro que quieres reiniciar todo el juego?')) return;
    await this.tableroService.resetJuego();
    this.mostrandoAdmin.set(false);
  }

  getPremioLabel(premio: number): string {
    return this.tableroService.getPremioLabel(premio);
  }

  papelTrackBy(_: number, item: { key: string; value: Papel }): string {
    return item.key;
  }
}
