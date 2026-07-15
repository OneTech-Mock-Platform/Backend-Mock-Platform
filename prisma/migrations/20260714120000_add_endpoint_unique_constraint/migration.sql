-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_specId_path_method_key" ON "Endpoint"("specId", "path", "method");
