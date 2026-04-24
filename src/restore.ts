import restore from "./restoreImplementation.js";
import { StateProvider } from "./stateProvider.js";

const restoreRun = async (): Promise<void> => restore(new StateProvider());

restoreRun();

export default restoreRun;
