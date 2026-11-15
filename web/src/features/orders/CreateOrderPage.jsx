import { useEffect, useState } from 'react'
import {
  createDeliveryOrder,
  getConfiguredCustomerId,
  getMyAddresses,
} from './orderService'
import './orders.css'

const initialPackage = {
  description: '',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  declaredValue: '0',
  isFragile: false,
  isHazardous: false,
}

export default function CreateOrderPage({ onCreated }) {
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [sender, setSender] = useState({ name: '', phone: '', addressText: '' })
  const [recipient, setRecipient] = useState({ name: '', phone: '' })
  const [packageInfo, setPackageInfo] = useState(initialPackage)
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    getMyAddresses()
      .then((items) => {
        if (!active) return
        setAddresses(items)
        const defaultAddress = items.find((item) => item.isDefault) || items[0]
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id)
          setRecipient((current) => ({
            ...current,
            addressText: formatAddress(defaultAddress),
          }))
        }
      })
      .catch((err) => active && setError(`Không tải được địa chỉ: ${err.message}`))
      .finally(() => active && setLoadingAddresses(false))
    return () => { active = false }
  }, [])

  function handleAddressChange(id) {
    setSelectedAddressId(id)
    const address = addresses.find((item) => item.id === id)
    setRecipient((current) => ({
      ...current,
      addressText: address ? formatAddress(address) : '',
    }))
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    setPhotoDataUrl('')
    setPhotoName('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ảnh tối đa 2 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''))
      setPhotoName(file.name)
      setError('')
    }
    reader.onerror = () => setError('Không đọc được ảnh đã chọn.')
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const customerId = getConfiguredCustomerId()
    if (!customerId) {
      setError('Thiếu Customer ID. Hãy cấu hình VITE_CUSTOMER_ID hoặc localStorage.customerId.')
      return
    }
    const address = addresses.find((item) => item.id === selectedAddressId)
    if (!address) {
      setError('Vui lòng chọn địa chỉ người nhận đã lưu.')
      return
    }
    if (!sender.name.trim() || !sender.phone.trim() || !sender.addressText.trim()) {
      setError('Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ người gửi.')
      return
    }
    if (!recipient.name.trim() || !recipient.phone.trim()) {
      setError('Vui lòng nhập tên và số điện thoại người nhận.')
      return
    }

    const numericFields = ['weightKg', 'lengthCm', 'widthCm', 'heightCm']
    if (numericFields.some((key) => !Number.isFinite(Number(packageInfo[key])) || Number(packageInfo[key]) <= 0)) {
      setError('Cân nặng và ba kích thước phải là số lớn hơn 0.')
      return
    }

    const body = {
      customerId,
      pickupMethod: 'SENDER_ADDRESS',
      deliveryMethod: 'CUSTOMER_ADDRESS',
      sender: {
        name: sender.name.trim(),
        phone: sender.phone.trim(),
        addressText: sender.addressText.trim(),
        latitude: 0,
        longitude: 0,
      },
      recipient: {
        name: recipient.name.trim(),
        phone: recipient.phone.trim(),
        addressText: recipient.addressText,
        latitude: Number(address.latitude || 0),
        longitude: Number(address.longitude || 0),
      },
      packages: [{
        description: packageInfo.description.trim() || 'Kiện hàng',
        weightKg: Number(packageInfo.weightKg),
        lengthCm: Number(packageInfo.lengthCm),
        widthCm: Number(packageInfo.widthCm),
        heightCm: Number(packageInfo.heightCm),
        declaredValue: Number(packageInfo.declaredValue || 0),
        isFragile: packageInfo.isFragile,
        isHazardous: packageInfo.isHazardous,
        packagePhotoUrl: photoDataUrl || null,
      }],
    }

    setSubmitting(true)
    try {
      const created = await createDeliveryOrder(body)
      setSuccess(`Tạo đơn hàng thành công${created?.trackingNumber ? `: ${created.trackingNumber}` : ''}.`)
      setPackageInfo(initialPackage)
      setPhotoDataUrl('')
      setPhotoName('')
      if (onCreated) onCreated(created)
    } catch (err) {
      setError(err.message || 'Không thể tạo đơn hàng.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="orders-page">
      <div className="orders-heading">
        <div>
          <p className="orders-eyebrow">CUSTOMER / DELIVERY</p>
          <h1>Tạo đơn giao hàng</h1>
          <p className="orders-subtitle">Nhập thông tin kiện hàng và địa chỉ giao nhận.</p>
        </div>
      </div>

      {error && <div className="orders-alert orders-alert-error" role="alert">{error}</div>}
      {success && <div className="orders-alert orders-alert-success" role="status">{success}</div>}

      <form className="orders-card orders-form" onSubmit={handleSubmit}>
        <h2>01. Thông tin người gửi</h2>
        <div className="orders-grid">
          <label className="orders-field">
            <span>Họ tên người gửi *</span>
            <input value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} required />
          </label>
          <label className="orders-field">
            <span>Số điện thoại người gửi *</span>
            <input value={sender.phone} onChange={(e) => setSender({ ...sender, phone: e.target.value })} required />
          </label>
          <label className="orders-field orders-field-full">
            <span>Địa chỉ lấy hàng *</span>
            <input value={sender.addressText} onChange={(e) => setSender({ ...sender, addressText: e.target.value })} required />
          </label>
        </div>

        <hr />
        <h2>02. Địa chỉ người nhận</h2>
        <div className="orders-grid">
          <label className="orders-field orders-field-full">
            <span>Chọn địa chỉ đã lưu *</span>
            <select value={selectedAddressId} onChange={(e) => handleAddressChange(e.target.value)} disabled={loadingAddresses || addresses.length === 0}>
              <option value="">{loadingAddresses ? 'Đang tải địa chỉ...' : 'Chọn địa chỉ'}</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {formatAddress(address)}{address.isDefault ? ' (Mặc định)' : ''}
                </option>
              ))}
            </select>
            {!loadingAddresses && addresses.length === 0 && <small>Chưa có địa chỉ. Hãy tạo địa chỉ trong mục Saved Addresses trước.</small>}
          </label>
          <label className="orders-field">
            <span>Họ tên người nhận *</span>
            <input value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} required />
          </label>
          <label className="orders-field">
            <span>Số điện thoại người nhận *</span>
            <input value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} required />
          </label>
          <label className="orders-field orders-field-full">
            <span>Địa chỉ giao hàng</span>
            <textarea value={recipient.addressText || ''} readOnly rows="2" />
          </label>
        </div>

        <hr />
        <h2>03. Thông tin kiện hàng</h2>
        <div className="orders-grid">
          <label className="orders-field orders-field-full">
            <span>Mô tả kiện hàng</span>
            <input value={packageInfo.description} onChange={(e) => setPackageInfo({ ...packageInfo, description: e.target.value })} placeholder="Ví dụ: Hồ sơ, quần áo..." />
          </label>
          <NumberField label="Cân nặng (kg) *" value={packageInfo.weightKg} onChange={(value) => setPackageInfo({ ...packageInfo, weightKg: value })} />
          <NumberField label="Chiều dài (cm) *" value={packageInfo.lengthCm} onChange={(value) => setPackageInfo({ ...packageInfo, lengthCm: value })} />
          <NumberField label="Chiều rộng (cm) *" value={packageInfo.widthCm} onChange={(value) => setPackageInfo({ ...packageInfo, widthCm: value })} />
          <NumberField label="Chiều cao (cm) *" value={packageInfo.heightCm} onChange={(value) => setPackageInfo({ ...packageInfo, heightCm: value })} />
          <NumberField label="Giá trị khai báo (VNĐ)" value={packageInfo.declaredValue} onChange={(value) => setPackageInfo({ ...packageInfo, declaredValue: value })} min="0" />
          <div className="orders-field orders-field-full orders-checkboxes">
            <label><input type="checkbox" checked={packageInfo.isFragile} onChange={(e) => setPackageInfo({ ...packageInfo, isFragile: e.target.checked })} /> Hàng dễ vỡ</label>
            <label><input type="checkbox" checked={packageInfo.isHazardous} onChange={(e) => setPackageInfo({ ...packageInfo, isHazardous: e.target.checked })} /> Hàng nguy hiểm</label>
          </div>
          <label className="orders-field orders-field-full">
            <span>Ảnh kiện hàng (tối đa 2 MB)</span>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
            {photoName && <small>Đã chọn: {photoName}</small>}
            {photoDataUrl && <img className="orders-photo-preview" src={photoDataUrl} alt="Xem trước kiện hàng" />}
          </label>
        </div>
        <div className="orders-form-actions">
          <button className="orders-button orders-button-primary" type="submit" disabled={submitting || loadingAddresses}>
            {submitting ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
          </button>
        </div>
      </form>
    </section>
  )
}

function NumberField({ label, value, onChange, min = '0.01' }) {
  return (
    <label className="orders-field">
      <span>{label}</span>
      <input type="number" min={min} step="any" value={value} onChange={(e) => onChange(e.target.value)} required={label.includes('*')} />
    </label>
  )
}

function formatAddress(address) {
  return [address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(', ')
}


