import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/types';

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (data && data.length > 0) {
      setItems(data as CategoryItem[]);
      setCategories(data.map((c: CategoryItem) => c.name));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, items, loading, refetch: fetchCategories };
}
