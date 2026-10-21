import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'
import GpuModel from './GpuModel'
import StorageModel from './StorageModel'
import PsuModel from './PsuModel'
import CaseModel from './CaseModel'
import FansModel from './FansModel'
import AirCoolerModel from './AirCoolerModel'
import DriveModel from './DriveModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
  gpu: GpuModel,
  storage: StorageModel,
  psu: PsuModel,
  case: CaseModel,
  fans: FansModel,
}

// Parts drawn at a partOverrides box instead of from a mesh — see PartModel.
export const BOX_MODELS = {
  cooler: AirCoolerModel,
  storage: DriveModel,
}
