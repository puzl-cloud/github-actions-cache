import restore from "./restoreImplementation";
import { StateProvider } from "./stateProvider";

const restoreRun = async (): Promise<void> => restore(new StateProvider());

restoreRun();

export default restoreRun;
