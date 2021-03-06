import { Sendable } from '../../models/Sendable';
import { TaskBuilder } from '../../models/TaskBuilder';
import { htmlToElement } from '../../utils/dom';
import { readPdf } from '../../utils/pdf';
import { Parser } from '../Parser';

export class UVaOnlineJudgeProblemParser extends Parser {
  public getMatchPatterns(): string[] {
    return ['https://onlinejudge.org/index.php*', 'https://icpcarchive.ecs.baylor.edu/index.php*'];
  }

  public getRegularExpressions(): RegExp[] {
    return [
      /https:\/\/onlinejudge\.org\/index\.php\?(.*)page=show_problem(.*)problem=(\d+)(.*)/,
      /https:\/\/icpcarchive\.ecs\.baylor\.edu\/index\.php\?(.*)page=show_problem(.*)problem=(\d+)(.*)/,
    ];
  }

  public async parse(url: string, html: string): Promise<Sendable> {
    const elem = htmlToElement(html);

    const container = elem.querySelector('#col3_content_wrapper, td.main');

    const isUVa = !container.classList.contains('main');
    const task = new TaskBuilder(isUVa ? 'UVa Online Judge' : 'ICPC Live Archive').setUrl(url);

    const header = container.querySelector('h3');
    const iframe = container.querySelector('iframe');

    task.setName(header.textContent);

    task.setTimeLimit(parseFloat(/Time limit: ([0-9.]+) seconds/.exec(header.nextSibling.textContent)[1]) * 1000);
    task.setMemoryLimit(32);

    try {
      const iframeUrl = iframe.src;

      const firstPart = /(.*)\//.exec(iframeUrl)[1];
      const secondPart = /(?:.*)\/(.*)\.html/.exec(iframeUrl)[1];
      const pdfUrl = firstPart + '/p' + secondPart + '.pdf';

      await this.parseTestsFromPdf(task, pdfUrl);
    } catch (err) {
      // Do nothing
    }

    return task.build();
  }

  public async parseTestsFromPdf(task: TaskBuilder, pdfUrl: string): Promise<void> {
    const lines = await readPdf(pdfUrl);

    const interactiveKeywords = ['interaction protocol', 'sample interaction'];
    task.setInteractive(lines.some(line => interactiveKeywords.indexOf(line.toLowerCase()) > -1));

    const inputStart = lines.findIndex(line => line.toLowerCase() === 'sample input');
    const outputStart = lines.findIndex(line => line.toLowerCase() === 'sample output');

    if (inputStart !== -1 && outputStart !== -1) {
      const input = lines.slice(inputStart + 1, outputStart).join('\n');
      const output = lines.slice(outputStart + 1).join('\n');

      task.addTest(input, output);
    }
  }
}
