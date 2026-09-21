export const CLI_COMMAND_NAME = "fdcode";
export const CLI_PROCESS_NAME = "fdcode-cli";

interface ProcessTitleTarget {
  title: string;
}

export const setCliProcessTitle = (
  target: ProcessTitleTarget = process,
): void => {
  target.title = CLI_PROCESS_NAME;
};
