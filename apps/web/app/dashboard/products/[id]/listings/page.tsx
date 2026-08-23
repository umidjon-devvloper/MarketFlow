'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { ListingsWorkspace } from '@/components/listings/ListingsWorkspace';

/**
 * Mahsulot ichidan ochiladigan kartochkalar sahifasi.
 *
 * Butun mantiq `ListingsWorkspace` da — shu bilan `/dashboard/listings`
 * (mahsulot tanlash bilan) bir xil ishlaydi.
 */
export default function ProductListingsPage() {
  const params = useParams();
  const productId = params.id as string;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          href={`/dashboard/products/${productId}`}
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" /> Mahsulotga qaytish
        </Link>
        <Link
          href={`/dashboard/listings?product=${productId}`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <LayoutGrid className="w-4 h-4" />
          Barcha mahsulotlar bilan ochish
        </Link>
      </div>

      <ListingsWorkspace productId={productId} />
    </div>
  );
}
