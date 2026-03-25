// iParkBayan — Mock data and types
// Design: Civic Tech / Modern Filipino Urban Identity

export type SlotStatus = "available" | "occupied" | "reserved";

export interface ParkingSlot {
  id: string;
  label: string;
  status: SlotStatus;
  floor?: string;
  row?: string;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  type: "private" | "public";
  totalSlots: number;
  availableSlots: number;
  distance: string;
  ratePerHour: number;
  openHours: string;
  lat: number;
  lng: number;
  slots: ParkingSlot[];
}

export interface Reservation {
  id: string;
  lotName: string;
  slotLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  amount: number;
  status: "active" | "completed" | "cancelled" | "pending";
  vehiclePlate: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  color: string;
  isDefault: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "reservation" | "availability" | "system";
}

// Mock Parking Lots
export const parkingLots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "Parking 1",
    address: "JP Laurel Highway, Lipa City",
    type: "private",
    totalSlots: 24,
    availableSlots: 9,
    distance: "0.3 km",
    ratePerHour: 30,
    openHours: "8:00 AM – 10:00 PM",
    lat: 13.9411,
    lng: 121.1631,
    slots: generateSlots(24, "Park1"),
  },
  {
    id: "lot-2",
    name: "Parking 2",
    address: "Ayala Highway, Lipa City",
    type: "private",
    totalSlots: 18,
    availableSlots: 5,
    distance: "0.7 km",
    ratePerHour: 25,
    openHours: "9:00 AM – 9:00 PM",
    lat: 13.9380,
    lng: 121.1600,
    slots: generateSlots(18, "RP"),
  },
  {
    id: "lot-3",
    name: "Lipa City Hall Parking",
    address: "C.M. Recto Ave, Lipa City",
    type: "public",
    totalSlots: 30,
    availableSlots: 14,
    distance: "1.2 km",
    ratePerHour: 0,
    openHours: "6:00 AM – 8:00 PM",
    lat: 13.9450,
    lng: 121.1650,
    slots: generateSlots(30, "CH"),
  },
  {
    id: "lot-4",
    name: "De La Salle Lipa Parking",
    address: "Maharlika Highway, Lipa City",
    type: "private",
    totalSlots: 20,
    availableSlots: 11,
    distance: "1.8 km",
    ratePerHour: 20,
    openHours: "7:00 AM – 9:00 PM",
    lat: 13.9500,
    lng: 121.1700,
    slots: generateSlots(20, "DL"),
  },
];

function generateSlots(count: number, prefix: string): ParkingSlot[] {
  const statuses: SlotStatus[] = ["available", "occupied", "reserved"];
  const rows = ["A", "B", "C", "D"];
  return Array.from({ length: count }, (_, i) => {
    const row = rows[Math.floor(i / 6)];
    const num = (i % 6) + 1;
    // Deterministic but varied status
    const statusIndex = (i * 7 + 3) % 10;
    const status: SlotStatus =
      statusIndex < 4 ? "available" : statusIndex < 8 ? "occupied" : "reserved";
    return {
      id: `${prefix.toLowerCase()}-slot-${i + 1}`,
      label: `${row}${num}`,
      status,
      floor: "G/F",
      row,
    };
  });
}

// Mock Reservations
export const mockReservations: Reservation[] = [
  {
    id: "res-001",
    lotName: "Parking 1",
    slotLabel: "A3",
    date: "Mar 20, 2026",
    startTime: "10:00 AM",
    endTime: "12:00 PM",
    duration: "2 hours",
    amount: 60,
    status: "active",
    vehiclePlate: "ABC 1234",
  },
  {
    id: "res-002",
    lotName: "Parking 2",
    slotLabel: "B2",
    date: "Mar 18, 2026",
    startTime: "2:00 PM",
    endTime: "5:00 PM",
    duration: "3 hours",
    amount: 75,
    status: "completed",
    vehiclePlate: "ABC 1234",
  },
  {
    id: "res-003",
    lotName: "De La Salle Lipa Parking",
    slotLabel: "C1",
    date: "Mar 15, 2026",
    startTime: "8:00 AM",
    endTime: "10:00 AM",
    duration: "2 hours",
    amount: 40,
    status: "completed",
    vehiclePlate: "XYZ 5678",
  },
  {
    id: "res-004",
    lotName: "Parking 1",
    slotLabel: "D4",
    date: "Mar 22, 2026",
    startTime: "9:00 AM",
    endTime: "11:00 AM",
    duration: "2 hours",
    amount: 60,
    status: "pending",
    vehiclePlate: "ABC 1234",
  },
];

// Mock Vehicles
export const mockVehicles: Vehicle[] = [
  { id: "v1", plate: "ABC 1234", model: "Toyota Vios", color: "White", isDefault: true },
  { id: "v2", plate: "XYZ 5678", model: "Honda City", color: "Silver", isDefault: false },
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: "n1",
    title: "Reservation Confirmed",
    message: "Your reservation at Parking 1 (Slot A3) is confirmed for Mar 20 at 10:00 AM.",
    time: "2 min ago",
    read: false,
    type: "reservation",
  },
  {
    id: "n2",
    title: "Slot Now Available",
    message: "A parking slot at Parking 2 is now available near your saved location.",
    time: "15 min ago",
    read: false,
    type: "availability",
  },
  {
    id: "n3",
    title: "Reservation Reminder",
    message: "Your reservation at Parking 1 starts in 30 minutes. Please proceed to Slot A3.",
    time: "1 hr ago",
    read: true,
    type: "reservation",
  },
  {
    id: "n4",
    title: "Reservation Completed",
    message: "Your parking session at Parking 2 has ended. Thank you for using iParkBayan!",
    time: "2 days ago",
    read: true,
    type: "system",
  },
];

// Admin stats
export const adminStats = {
  totalSlots: 92,
  availableSlots: 39,
  occupiedSlots: 41,
  reservedSlots: 12,
  todayReservations: 28,
  todayRevenue: 1240,
  activeUsers: 156,
  weeklyOccupancy: [62, 74, 58, 81, 69, 77, 65],
};
