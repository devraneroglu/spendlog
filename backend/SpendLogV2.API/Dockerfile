# ====================================================================
# SpendLog V2 — Backend Web API (.NET 10) Multi-Stage Dockerfile
# ====================================================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files for caching dependency restore
COPY ["backend/SpendLogV2.Domain/SpendLogV2.Domain.csproj", "backend/SpendLogV2.Domain/"]
COPY ["backend/SpendLogV2.Application/SpendLogV2.Application.csproj", "backend/SpendLogV2.Application/"]
COPY ["backend/SpendLogV2.Infrastructure/SpendLogV2.Infrastructure.csproj", "backend/SpendLogV2.Infrastructure/"]
COPY ["backend/SpendLogV2.API/SpendLogV2.API.csproj", "backend/SpendLogV2.API/"]

RUN dotnet restore "backend/SpendLogV2.API/SpendLogV2.API.csproj"

# Copy full source and publish
COPY backend/ backend/
WORKDIR "/src/backend/SpendLogV2.API"
RUN dotnet publish "SpendLogV2.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:5007
EXPOSE 5007

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SpendLogV2.API.dll"]
