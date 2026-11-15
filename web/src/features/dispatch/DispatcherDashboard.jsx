import { useState } from 'react'
import {
  INITIAL_PENDING_ORDERS,
  INITIAL_DRONES,
  INITIAL_STATIONS,
  reviewOrderApprovalApi,
  assignFlightScheduleApi,
} from './dispatchService'
import { AssignDroneModal } from './AssignDroneModal'
import './dispatch.css'

export function DispatcherDashboard() {
  const [orders, setOrders] = useState(INITIAL_PENDING_ORDERS)
  const [drones, setDrones] = useState(INITIAL_DRONES)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  const filteredOrders = orders.filter((order) =>
    statusFilter === 'ALL' ? true : order.status === statusFilter
  )

  const handleReviewOrder = async (orderId, isApproved) => {
    const newStatus = isApproved ? 'APPROVED' : 'REJECTED'

    await reviewOrderApprovalApi({
      orderId,
      approvedByUserId: '11111111-1111-1111-1111-111111111002',
      isApproved,
      rejectionReason: isApproved ? null : 'Rejected by dispatcher review.',
    })

    setOrders((prev) =>
      prev.map((item) => (item.id === orderId ? { ...item, status: newStatus } : item))
    )
    setActionMessage(`Order ${orderId.slice(-4)} updated to ${newStatus}.`)
  }

  const handleConfirmAssignDrone = async (schedulePayload) => {
    await assignFlightScheduleApi(schedulePayload)

    const assignedDrone = drones.find((d) => d.id === schedulePayload.droneId)

    setOrders((prev) =>
      prev.map((item) =>
        item.id === schedulePayload.orderId
          ? {
              ...item,
              status: 'SCHEDULED',
              assignedDroneCode: assignedDrone?.droneCode || 'DRN',
            }
          : item
      )
    )

    setDrones((prev) =>
      prev.map((d) =>
        d.id === schedulePayload.droneId ? { ...d, status: 'ASSIGNED' } : d
      )
    )

    setSelectedOrderForModal(null)
    setActionMessage(
      `Flight scheduled with drone ${assignedDrone?.droneCode || ''} for order ${schedulePayload.orderId.slice(-4)}.`
    )
  }

  const pendingCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length
  const approvedCount = orders.filter((o) => o.status === 'APPROVED').length
  const scheduledCount = orders.filter((o) => o.status === 'SCHEDULED').length
  const idleDroneCount = drones.filter((d) => d.status === 'IDLE').length

  return (
    <div className="dispatch-container">
      <div className="dispatch-kpi-grid">
        <div className="dispatch-kpi-card">
          <span className="dispatch-kpi-label">Pending Approval</span>
          <strong className="dispatch-kpi-value">{pendingCount}</strong>
        </div>
        <div className="dispatch-kpi-card">
          <span className="dispatch-kpi-label">Approved &amp; Ready</span>
          <strong className="dispatch-kpi-value">{approvedCount}</strong>
        </div>
        <div className="dispatch-kpi-card">
          <span className="dispatch-kpi-label">Scheduled Flights</span>
          <strong className="dispatch-kpi-value">{scheduledCount}</strong>
        </div>
        <div className="dispatch-kpi-card">
          <span className="dispatch-kpi-label">Available Drones (IDLE)</span>
          <strong className="dispatch-kpi-value">{idleDroneCount}</strong>
        </div>
      </div>

      {actionMessage && <div className="dispatch-banner">{actionMessage}</div>}

      <section className="dispatch-panel">
        <div className="dispatch-panel-header">
          <div>
            <h2>Delivery Order Approval &amp; Flight Dispatch Queue</h2>
            <p>Verify package payload (&lt;= 5.00 kg) before approving and scheduling drone flights.</p>
          </div>
          <div className="dispatch-filter-group">
            {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'REJECTED'].map(
              (filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`dispatch-filter-btn ${statusFilter === filterKey ? 'active' : ''}`}
                  onClick={() => setStatusFilter(filterKey)}
                >
                  {filterKey}
                </button>
              )
            )}
          </div>
        </div>

        <div className="dispatch-table-wrapper">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Route (Sender -&gt; Recipient)</th>
                <th>Weight (kg)</th>
                <th>Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.trackingNumber}</strong>
                    <div className="dispatch-subtext">{order.createdAt}</div>
                  </td>
                  <td>
                    <div>
                      <strong>From:</strong> {order.senderAddress}
                    </div>
                    <div>
                      <strong>To:</strong> {order.recipientName} ({order.recipientAddress})
                    </div>
                  </td>
                  <td>
                    <span className="dispatch-weight">{order.totalWeightKg.toFixed(2)} kg</span>
                    {order.isFragile && <span className="dispatch-tag-fragile">Fragile</span>}
                  </td>
                  <td>
                    <div className="dispatch-subtext">{order.pickupMethod}</div>
                    <div className="dispatch-subtext">-&gt; {order.deliveryMethod}</div>
                  </td>
                  <td>
                    <span className={`dispatch-badge status-${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="dispatch-action-group">
                      {order.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            className="btn-approve"
                            onClick={() => handleReviewOrder(order.id, true)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-reject"
                            onClick={() => handleReviewOrder(order.id, false)}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {order.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="btn-assign"
                          onClick={() => setSelectedOrderForModal(order)}
                        >
                          Assign Drone
                        </button>
                      )}

                      {order.status === 'SCHEDULED' && (
                        <span className="dispatch-subtext">
                          Assigned ({order.assignedDroneCode || 'Drone'})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dispatch-panel">
        <div className="dispatch-panel-header">
          <div>
            <h2>Drone Fleet Status</h2>
            <p>Real-time battery level and payload capacity across active drones.</p>
          </div>
        </div>

        <div className="dispatch-table-wrapper">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th>Drone Code</th>
                <th>Model</th>
                <th>Max Payload</th>
                <th>Max Range</th>
                <th>Battery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drones.map((drone) => (
                <tr key={drone.id}>
                  <td>
                    <strong>{drone.droneCode}</strong>
                  </td>
                  <td>{drone.model}</td>
                  <td>{drone.maxPayloadKg.toFixed(2)} kg</td>
                  <td>{drone.maxFlightRangeKm.toFixed(1)} km</td>
                  <td>{drone.batteryPercentage}%</td>
                  <td>
                    <span className={`dispatch-badge status-${drone.status.toLowerCase()}`}>
                      {drone.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrderForModal && (
        <AssignDroneModal
          order={selectedOrderForModal}
          drones={drones}
          stations={INITIAL_STATIONS}
          onClose={() => setSelectedOrderForModal(null)}
          onConfirmAssign={handleConfirmAssignDrone}
        />
      )}
    </div>
  )
}

export default DispatcherDashboard
