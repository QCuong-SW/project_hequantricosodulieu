import { useState } from 'react'
import { INITIAL_STATIONS } from './dispatchService'

export function AssignDroneModal({
  order,
  drones = [],
  stations = INITIAL_STATIONS,
  onClose,
  onConfirmAssign,
}) {
  const eligibleDrones = drones.filter(
    (d) => d.status === 'IDLE' && d.maxPayloadKg >= order.totalWeightKg && d.batteryPercentage >= 30
  )

  const [selectedDroneId, setSelectedDroneId] = useState(
    eligibleDrones[0]?.id || ''
  )
  const [originStationId, setOriginStationId] = useState(
    stations[0]?.id || ''
  )
  const [destinationStationId, setDestinationStationId] = useState(
    stations[1]?.id || ''
  )
  const [flightDistanceKm, setFlightDistanceKm] = useState('12.5')
  const [targetAltitudeMeter, setTargetAltitudeMeter] = useState('65')
  const [errorMsg, setErrorMsg] = useState('')

  if (!order) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!selectedDroneId) {
      setErrorMsg('Please select an available drone.')
      return
    }

    if (!originStationId || !destinationStationId) {
      setErrorMsg('Origin and Destination stations are required.')
      return
    }

    if (originStationId === destinationStationId) {
      setErrorMsg('Origin station and Destination station must be different.')
      return
    }

    const distance = parseFloat(flightDistanceKm)
    const altitude = parseFloat(targetAltitudeMeter)

    if (Number.isNaN(distance) || distance <= 0) {
      setErrorMsg('Flight distance must be greater than 0 km.')
      return
    }

    if (Number.isNaN(altitude) || altitude < 10 || altitude > 120) {
      setErrorMsg('Cruise altitude must be between 10m and 120m.')
      return
    }

    const originStation = stations.find((s) => s.id === originStationId)
    const destStation = stations.find((s) => s.id === destinationStationId)

    const waypoints = [
      {
        sequenceOrder: 1,
        latitude: originStation?.latitude || 10.771595,
        longitude: originStation?.longitude || 106.70475,
        targetAltitudeMeter: altitude,
        estimatedSpeedKmh: 45,
      },
      {
        sequenceOrder: 2,
        latitude: destStation?.latitude || 10.841128,
        longitude: destStation?.longitude || 106.809883,
        targetAltitudeMeter: altitude,
        estimatedSpeedKmh: 50,
      },
    ]

    onConfirmAssign({
      orderId: order.id,
      droneId: selectedDroneId,
      originStationId,
      destinationStationId,
      orderWeightKg: order.totalWeightKg,
      flightDistanceKm: distance,
      scheduledDeparture: new Date(Date.now() + 15 * 60000).toISOString(),
      waypoints,
    })
  }

  return (
    <div className="dispatch-modal-backdrop">
      <div className="dispatch-modal">
        <div className="dispatch-modal-header">
          <h3>Assign Drone &amp; Schedule Flight</h3>
          <button type="button" className="dispatch-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="dispatch-modal-summary">
          <div>
            <strong>Tracking:</strong> {order.trackingNumber}
          </div>
          <div>
            <strong>Payload Weight:</strong> {order.totalWeightKg.toFixed(2)} kg (Max limit: 5.00 kg)
          </div>
          <div>
            <strong>Recipient:</strong> {order.recipientName} — {order.recipientAddress}
          </div>
        </div>

        {errorMsg && <div className="dispatch-modal-error">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="dispatch-modal-form">
          <label className="dispatch-form-field">
            <span>Select Eligible Drone (IDLE &amp; Payload &gt;= {order.totalWeightKg} kg)</span>
            <select
              value={selectedDroneId}
              onChange={(e) => setSelectedDroneId(e.target.value)}
            >
              {eligibleDrones.length === 0 ? (
                <option value="">No eligible drone available</option>
              ) : (
                eligibleDrones.map((drone) => (
                  <option key={drone.id} value={drone.id}>
                    {drone.droneCode} — {drone.model} (Max {drone.maxPayloadKg} kg | Battery {drone.batteryPercentage}%)
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="dispatch-form-row">
            <label className="dispatch-form-field">
              <span>Origin Landing Station</span>
              <select
                value={originStationId}
                onChange={(e) => setOriginStationId(e.target.value)}
              >
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationCode} — {station.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="dispatch-form-field">
              <span>Destination Landing Station</span>
              <select
                value={destinationStationId}
                onChange={(e) => setDestinationStationId(e.target.value)}
              >
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationCode} — {station.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dispatch-form-row">
            <label className="dispatch-form-field">
              <span>Estimated Flight Distance (km)</span>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="30"
                value={flightDistanceKm}
                onChange={(e) => setFlightDistanceKm(e.target.value)}
              />
            </label>

            <label className="dispatch-form-field">
              <span>Target Cruise Altitude (10m – 120m)</span>
              <input
                type="number"
                step="1"
                min="10"
                max="120"
                value={targetAltitudeMeter}
                onChange={(e) => setTargetAltitudeMeter(e.target.value)}
              />
            </label>
          </div>

          <div className="dispatch-modal-actions">
            <button type="button" className="btn-cancel-modal" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-assign"
              disabled={eligibleDrones.length === 0}
            >
              Confirm Flight Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AssignDroneModal
