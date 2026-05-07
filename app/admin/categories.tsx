import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';

type CategoryRow = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
};

const ICON_OPTIONS = ['🏃', '☕', '🎉', '🎵', '🎨', '🏅', '🎬', '🧘', '💻', '🌱', '🎮', '⛸', '💃', '🍔', '🤝', '🍻', '⚽', '🏊', '🎤', '📚', '✈️', '🐕', '🎭', '🏋️', '🎳', '🚴', '📸', '🌍'];

export default function AdminCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('●');
  const [saving, setSaving] = useState(false);

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    setCategories((data ?? []) as CategoryRow[]);
    setLoading(false);
  }

  useEffect(() => { loadCategories(); }, []);

  async function saveCategory() {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    if (editTarget) {
      await supabase.from('categories').update({ name: newName.trim(), icon: newIcon }).eq('id', editTarget.id);
      setCategories(prev => prev.map(c => c.id === editTarget.id ? { ...c, name: newName.trim(), icon: newIcon } : c));
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0;
      const { data } = await supabase.from('categories').insert({ name: newName.trim(), icon: newIcon, sort_order: maxOrder + 1 }).select().single();
      if (data) setCategories(prev => [...prev, data as CategoryRow]);
    }
    setNewName('');
    setNewIcon('●');
    setEditTarget(null);
    setShowAdd(false);
    setSaving(false);
  }

  async function toggleActive(cat: CategoryRow) {
    await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id);
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !c.active } : c));
  }

  async function moveUp(cat: CategoryRow) {
    const idx = categories.findIndex(c => c.id === cat.id);
    if (idx <= 0) return;
    const prev = categories[idx - 1];
    await Promise.all([
      supabase.from('categories').update({ sort_order: prev.sort_order }).eq('id', cat.id),
      supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', prev.id),
    ]);
    const updated = [...categories];
    [updated[idx].sort_order, updated[idx - 1].sort_order] = [updated[idx - 1].sort_order, updated[idx].sort_order];
    setCategories([...updated].sort((a, b) => a.sort_order - b.sort_order));
  }

  async function moveDown(cat: CategoryRow) {
    const idx = categories.findIndex(c => c.id === cat.id);
    if (idx >= categories.length - 1) return;
    const next = categories[idx + 1];
    await Promise.all([
      supabase.from('categories').update({ sort_order: next.sort_order }).eq('id', cat.id),
      supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', next.id),
    ]);
    const updated = [...categories];
    [updated[idx].sort_order, updated[idx + 1].sort_order] = [updated[idx + 1].sort_order, updated[idx].sort_order];
    setCategories([...updated].sort((a, b) => a.sort_order - b.sort_order));
  }

  function deleteConfirm(cat: CategoryRow) {
    Alert.alert(
      'Delete category',
      `Delete "${cat.name}"? This won't affect existing events/clubs that already use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('categories').delete().eq('id', cat.id);
            setCategories(prev => prev.filter(c => c.id !== cat.id));
          },
        },
      ]
    );
  }

  function openEdit(cat: CategoryRow) {
    setEditTarget(cat);
    setNewName(cat.name);
    setNewIcon(cat.icon);
    setShowAdd(true);
  }

  const renderItem = ({ item, index }: { item: CategoryRow; index: number }) => (
    <View style={[styles.row, !item.active && styles.rowInactive]}>
      <Text style={styles.rowIcon}>{item.icon}</Text>
      <Text style={[styles.rowName, !item.active && styles.rowNameInactive]}>{item.name}</Text>

      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => moveUp(item)} disabled={index === 0}>
          <Text style={[styles.iconBtnText, index === 0 && { opacity: 0.2 }]}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => moveDown(item)} disabled={index === categories.length - 1}>
          <Text style={[styles.iconBtnText, index === categories.length - 1 && { opacity: 0.2 }]}>↓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, item.active ? styles.iconBtnActive : styles.iconBtnOff]} onPress={() => toggleActive(item)}>
          <Text style={styles.iconBtnText}>{item.active ? '●' : '○'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
          <Text style={styles.iconBtnText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => deleteConfirm(item)}>
          <Text style={[styles.iconBtnText, { color: '#CC0000' }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditTarget(null); setNewName(''); setNewIcon('●'); setShowAdd(true); }}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Active categories appear in the app. Tap ● to toggle.</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* Add / Edit modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={[styles.formModal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => { setShowAdd(false); setEditTarget(null); }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{editTarget ? 'Edit category' : 'New category'}</Text>
            <TouchableOpacity onPress={saveCategory} disabled={saving}>
              <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formBody}>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.formInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Coffee"
              placeholderTextColor={Colors.gray}
              autoFocus
            />

            <Text style={styles.formLabel}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconOption, newIcon === icon && styles.iconOptionSelected]}
                  onPress={() => setNewIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.iconOption, newIcon === '●' && styles.iconOptionSelected]}
                onPress={() => setNewIcon('●')}
              >
                <Text style={styles.iconOptionText}>●</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.previewLabel}>Preview:</Text>
            <View style={styles.preview}>
              <Text style={styles.previewText}>{newIcon} {newName || 'Category name'}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  addBtn: { backgroundColor: Colors.black, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: Colors.lime, fontSize: 13, fontWeight: '700', fontFamily: Fonts.bold },
  hint: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  rowInactive: { opacity: 0.4 },
  rowIcon: { fontSize: 20, width: 32, textAlign: 'center' },
  rowName: { flex: 1, fontSize: 15, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black },
  rowNameInactive: { color: Colors.gray },
  rowActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: Colors.lime },
  iconBtnOff: { backgroundColor: Colors.grayBorder },
  iconBtnText: { fontSize: 14, color: Colors.black },
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 64 },
  formModal: { flex: 1, backgroundColor: Colors.white },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  formTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  saveBtn: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  formBody: { padding: 20, gap: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 16, color: Colors.black, fontFamily: Fonts.medium },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  iconOptionSelected: { backgroundColor: Colors.lime, borderWidth: 2, borderColor: Colors.black },
  iconOptionText: { fontSize: 22 },
  previewLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  preview: { backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14 },
  previewText: { fontSize: 16, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
});
