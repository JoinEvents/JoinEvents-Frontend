import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportService } from '../../core/services/support.service';
import { ConfirmService } from '../../shared/components/confirm-dialog';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.css'
})
export class AdminReviews implements OnInit {
  private support = inject(SupportService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  canModerate = computed(() => {
    const role = this.auth.getRole();
    return role === 'admin' || role === 'support';
  });

  activeTab = signal<'pending' | 'history'>('pending');

  reviews = signal<any[]>([]);

  flaggedReviews = computed(() => {
    return this.reviews().filter(r => r.status === 'flagged');
  });

  disputeHistory = computed(() => {
    return this.reviews().filter(r => r.resolution);
  });

  ngOnInit() {
    this.loadReviews();
  }

  loadReviews() {
    this.support.getFlaggedReviews().subscribe(r => {
      if (r) this.reviews.set(r);
    });
  }

  async resolve(id: string, action: 'keep' | 'remove') {
    const isKeep = action === 'keep';
    const confirmed = await this.confirm.ask({
      title: isKeep ? 'Keep Review' : 'Remove Review',
      message: isKeep 
        ? 'Are you sure you want to dismiss the vendor\'s dispute? The review will remain published.'
        : 'Are you sure you want to remove this review? This action cannot be undone.',
      confirmText: isKeep ? 'Keep Review' : 'Remove Review',
      type: isKeep ? 'primary' : 'danger'
    });

    if (confirmed) {
      this.support.moderateReview(id, action).subscribe(() => {
        this.loadReviews();
      });
    }
  }
}
