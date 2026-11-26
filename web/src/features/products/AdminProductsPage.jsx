import { useEffect, useState } from 'react'
import { API_V1_URL } from '../../config/apiConfig'
import { showToast } from '../../utils/toast'

const CATEGORIES = [
  'Tất cả',
  'Thiết bị & Công nghệ',
  'Y tế & Sức khỏe',
  'Ẩm thực & Đồ uống',
  'Tài liệu & Văn phòng',
  'Hàng tiêu dùng',
]

const EMPTY_FORM = {
  name: '',
  category: 'Ẩm thực & Đồ uống',
  description: '',
  imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  price: '165000',
  weightKg: '0.85',
  stock: '50',
  isFragile: false,
  isActive: true,
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Tất cả')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await fetch(`${API_V1_URL}/products`)
      const json = await res.json().catch(() => null)
      const items = json?.data || (Array.isArray(json) ? json : [])
      setProducts(items)
    } catch {
      setError('Không thể tải danh sách sản phẩm từ máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  function openCreateModal() {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEditModal(product) {
    setEditingProduct(product)
    setForm({
      name: product.name || '',
      category: product.category || 'Ẩm thực & Đồ uống',
      description: product.description || '',
      imageUrl: product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      price: String(product.price ?? 0),
      weightKg: String(product.weightKg ?? 0.5),
      stock: String(product.stock ?? 0),
      isFragile: Boolean(product.isFragile),
      isActive: product.isActive !== false,
    })
    setError('')
    setShowModal(true)
  }

  async function handleSaveProduct(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        imageUrl: form.imageUrl?.trim() || '',
        price: Number(form.price) || 0,
        weightKg: Number(form.weightKg) || 0.5,
        stock: Number(form.stock) || 0,
        isFragile: form.isFragile,
        isActive: form.isActive,
      }

      const url = editingProduct
        ? `${API_V1_URL}/products/${editingProduct.id}`
        : `${API_V1_URL}/products`
      const method = editingProduct ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.message || 'Không thể lưu thông tin sản phẩm.')
      }

      showToast(
        editingProduct
          ? `Đã cập nhật sản phẩm "${payload.name}"!`
          : `Đã thêm sản phẩm "${payload.name}" lên kệ hàng Mobile!`,
        'success'
      )
      setShowModal(false)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProduct(product) {
    try {
      const res = await fetch(`${API_V1_URL}/products/${product.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Không thể xóa sản phẩm.')
      showToast(`Đã xóa sản phẩm "${product.name}".`, 'info')
      await loadProducts()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleToggleActive(product) {
    try {
      const res = await fetch(`${API_V1_URL}/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          isActive: !product.isActive,
        }),
      })
      if (!res.ok) throw new Error('Không thể cập nhật trạng thái sản phẩm.')
      showToast(
        !product.isActive
          ? `Đã mở bán lại "${product.name}".`
          : `Đã tạm ngừng bán "${product.name}".`,
        'success'
      )
      await loadProducts()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'Tất cả' || p.category === selectedCategory
    const term = search.trim().toLowerCase()
    const matchSearch =
      !term ||
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term)
    return matchCategory && matchSearch
  })

  const activeCount = products.filter((p) => p.isActive).length
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0)

  return (
    <section className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Quản Lý Sản Phẩm Giao Bằng Drone
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Danh mục sản phẩm đồng bộ trực tiếp sang App Mobile Flutter để khách hàng đặt mua.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            + Thêm Sản Phẩm Mới
          </button>
          <button
            type="button"
            onClick={loadProducts}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition cursor-pointer"
          >
            {loading ? 'Đang tải...' : 'Làm Mới'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tổng sản phẩm
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{products.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Đang mở bán trên Mobile
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{activeCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
            Chuẩn tải trọng Drone
          </div>
          <div className="text-2xl font-black text-teal-700 font-mono mt-1">&le; 5.0 kg</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tổng tồn kho sẵn sàng
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{totalStock}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên sản phẩm, mã SKU..."
          className="w-full md:w-72 px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[11px] font-bold text-emerald-950 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-4">Mã SKU</th>
                <th className="py-3.5 px-4 min-w-[260px]">Tên Sản Phẩm</th>
                <th className="py-3.5 px-4">Danh Mục</th>
                <th className="py-3.5 px-4">Giá Bán</th>
                <th className="py-3.5 px-4">Khối Lượng</th>
                <th className="py-3.5 px-4">Tồn Kho</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Không tìm thấy sản phẩm nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="py-3.5 px-4 min-w-[260px]">
                      <div className="flex items-center gap-3">
                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-11 h-11 rounded-xl object-cover border border-emerald-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 max-w-md mt-0.5">
                            {p.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                      {Number(p.price || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {p.weightKg} kg
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {p.stock}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {p.isActive ? 'Đang bán' : 'Tạm ẩn'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="px-2.5 py-1 rounded-lg font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                        className="px-2.5 py-1 rounded-lg font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-emerald-100 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới Lên App Mobile'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Bộ Kit Y Tế Gia Đình"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
                  >
                    {CATEGORIES.filter((c) => c !== 'Tất cả').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                    Giá bán (VNĐ) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                    Trọng lượng (0.1 - 5.0 kg) *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="5.0"
                    step="0.05"
                    required
                    value={form.weightKg}
                    onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                    Số lượng tồn kho *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Mô tả chi tiết quy cách đóng gói và giao hàng bằng Drone..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFragile}
                    onChange={(e) => setForm({ ...form, isFragile: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-semibold text-slate-800">Hàng dễ vỡ (Chống sốc)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-semibold text-slate-800">Mở bán ngay trên Mobile</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu Sản Phẩm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
