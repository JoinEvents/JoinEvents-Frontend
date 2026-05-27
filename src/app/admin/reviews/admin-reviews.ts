import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
  private supportService = inject(SupportService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  canModerate = computed(() => {
    const role = this.auth.getRole();
    return role === 'admin' || role === 'support';
  });

  flaggedReviews = signal<any[]>([]);

  ngOnInit() {
    this.loadFlaggedReviews();
  }

  loadFlaggedReviews() {
    const fallbackReviews = [
      { id: 'rev2', bookingId: 'bk009', vendorId: 'v1', customerName: 'Anita Singh', eventName: 'Corporate Gala', rating: 1, comment: "Worst service ever. They didn't show up on time and the food was cold. Completely ruined the event.", date: '2026-02-14', status: 'flagged', disputeReason: 'Fake review. This customer cancelled the booking 2 days prior and we never provided service.' }
    ];

    this.supportService.getFlaggedReviews().subscribe({
      next: (data) => {
        this.flaggedReviews.set(data || []);
      },
      error: () => {
        this.flaggedReviews.set(fallbackReviews);
      }
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
      this.supportService.moderateReview(id, action).subscribe(() => {
        this.loadFlaggedReviews();
      });
    }
  }
}
