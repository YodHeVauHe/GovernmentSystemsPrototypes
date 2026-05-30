import { IconCircleCheck } from '@tabler/icons-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MATRIX_TARGETS, buildMatrixChannelRows } from '../view-helpers';
import { ViewModeToggle } from './dashboard-page-helpers';

export function MatrixPanel({ mdas, matrix, matrixViewMode, setMatrixViewMode }: any) {
  return (
              <div className="flex h-full min-h-0 flex-col gap-6 text-left">
                <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl p-6 shadow-lg">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">Government Data Interoperability Channels</h2>
                      <p className="mt-2 text-[12px] text-[#8b8b8b]">
                        Active matrix of approved MDA sharing links. Ensure that all exchanges are backed by statutory instruments.
                      </p>
                    </div>
                    <ViewModeToggle
                      value={matrixViewMode}
                      onChange={setMatrixViewMode}
                      gridLabel="Show interoperability matrix grid view"
                      listLabel="Show interoperability matrix list view"
                    />
                  </div>

                  {matrixViewMode === 'list' ? (
                    <div className="min-h-0 flex-1 overflow-auto">
                      <Table className="border border-[#2e2e2e] rounded-lg">
                        <TableHeader>
                          <TableRow className="border-b border-[#2e2e2e] bg-[#141414]">
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-white h-10 px-4">Consumer MDA</TableHead>
                            {MATRIX_TARGETS.map(target => (
                              <TableHead key={target.apiId} className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">
                                {target.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mdas.map((consumer: any) => (
                            <TableRow key={consumer.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/20">
                              <TableCell className="py-3 px-4 font-semibold text-[13px] text-white">
                                {consumer.name} ({consumer.shortName})
                              </TableCell>
                              {buildMatrixChannelRows(matrix, consumer.id).map(channel => (
                                <TableCell key={channel.apiId} className="py-3 px-4 text-center">
                                  {channel.active ? (
                                    <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                                  ) : (
                                    <span className="text-[#333] font-bold text-[12px]">-</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {mdas.map((consumer: any) => {
                          const channels = buildMatrixChannelRows(matrix, consumer.id);
                          const activeCount = channels.filter(channel => channel.active).length;

                          return (
                            <div key={consumer.id} className="rounded-lg border border-[#2e2e2e] bg-[#181818] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h3 className="truncate text-[15px] font-semibold text-white" title={consumer.name}>{consumer.name}</h3>
                                  <div className="mt-1 font-mono text-[12px] text-[#8b8b8b]">{consumer.shortName}</div>
                                </div>
                                <span className="shrink-0 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 px-2.5 py-0.5 font-mono text-[11px] text-[#3ecf8e]">
                                  {activeCount}/{channels.length} active
                                </span>
                              </div>
                              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {channels.map(channel => (
                                  <div key={channel.apiId} className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[#2e2e2e] bg-[#141414] px-3 py-2">
                                    <span className="min-w-0 truncate text-[12.5px] text-[#ededed]">{channel.label}</span>
                                    {channel.active ? (
                                      <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 px-2.5 font-mono text-[12px] uppercase text-[#3ecf8e]">
                                        <IconCircleCheck className="h-4.5 w-4.5" stroke={1.8} />
                                        Active
                                      </span>
                                    ) : (
                                      <span className="font-mono text-[11px] uppercase text-[#555]">Inactive</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
  );
}
