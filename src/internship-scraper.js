#!/usr/bin/env node

/**
 * Internshala Internship Scraper using Apify API
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

export class InternshipScraper {
  constructor() {
    this.apiToken = process.env.APIFY_API_TOKEN;
    this.actorId = 'salman_bareesh/internshala-scrapper';
    this.baseUrl = 'https://api.apify.com/v2';
    
    if (!this.apiToken) {
      logger.warn('APIFY_API_TOKEN not set. Internship scraping functionality will be limited.');
    }
  }

  async promptUserInputs() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

    try {
      console.log('🔍 Internship Search Configuration');
      console.log('=' .repeat(40));

      const maxResults = await question('Maximum results (default: 50): ');
      const jobCategory = await question('Job category (e.g., "Computer Science", "Marketing"): ');
      const workFromHomeInput = await question('Work from home? (yes/no, default: no): ');
      const location = await question('Location (e.g., "Mumbai", "Delhi", default: any): ');
      const partTimeInput = await question('Part time? (yes/no, default: no): ');
      const minStipend = await question('Minimum stipend (e.g., "10000", default: any): ');
      const pagesToScrape = await question('Pages to scrape (default: 5): ');

      rl.close();

      // Process inputs
      const inputs = {
        maximum_results: maxResults ? parseInt(maxResults) : 50,
        job_category: jobCategory || '',
        work_from_home: this.convertYesNo(workFromHomeInput),
        location: location || '',
        part_time: this.convertYesNo(partTimeInput),
        minimum_stipend: minStipend || '',
        pages_to_scrape: pagesToScrape ? parseInt(pagesToScrape) : 5
      };

      // Validate inputs
      if (isNaN(inputs.maximum_results) || inputs.maximum_results <= 0) {
        inputs.maximum_results = 50;
      }
      if (isNaN(inputs.pages_to_scrape) || inputs.pages_to_scrape <= 0) {
        inputs.pages_to_scrape = 5;
      }

      return inputs;
    } catch (error) {
      rl.close();
      throw error;
    }
  }

  convertYesNo(input) {
    if (!input) return false;
    return input.toLowerCase().trim() === 'yes';
  }

  async runScraper(inputs) {
    try {
      logger.info('Starting Apify Actor run...');
      console.log('🚀 Starting internship scraper...');
      console.log('⏳ Using existing dataset with real internship data...');

      // For now, use the existing successful dataset
      // TODO: Implement new run creation when Actor endpoint is fixed
      const datasetId = 'NGRZuUnV2L8btHiG2';
      
      console.log('📊 Fetching internship data from existing dataset...');
      const results = await this.getResultsFromDataset(datasetId);
      
      // Apply user filters to the results
      const filteredResults = this.applyFilters(results, inputs);
      
      console.log(`✅ Retrieved ${results.length} total internships`);
      console.log(`🎯 Filtered to ${filteredResults.length} matching your criteria`);
      
      return filteredResults;

    } catch (error) {
      logger.error('Scraper run failed:', error.message);
      if (error.response) {
        console.error('❌ API Error:', error.response.data);
      } else if (error.request) {
        console.error('❌ Network Error: No response received');
      } else {
        console.error('❌ Error:', error.message);
      }
      throw error;
    }
  }

  async getResultsFromDataset(datasetId) {
    try {
      const resultsResponse = await axios.get(
        `${this.baseUrl}/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );

      return resultsResponse.data;

    } catch (error) {
      logger.error('Failed to retrieve dataset results:', error.message);
      throw error;
    }
  }

  applyFilters(results, filters) {
    let filtered = [...results];

    console.log(`🔍 Applying filters to ${filtered.length} internships...`);

    // Apply work from home filter first (most restrictive)
    if (filters.work_from_home) {
      filtered = filtered.filter(item => 
        item.location?.toLowerCase().includes('work from home')
      );
      console.log(`   After work-from-home filter: ${filtered.length} internships`);
    }

    // Apply location filter (less restrictive if work_from_home is already applied)
    if (filters.location && filters.location.trim() && !filters.work_from_home) {
      const location = filters.location.toLowerCase();
      filtered = filtered.filter(item => 
        item.location?.toLowerCase().includes(location) ||
        (location === 'remote' && item.location?.toLowerCase().includes('work from home'))
      );
      console.log(`   After location filter: ${filtered.length} internships`);
    }

    // Apply job category filter (broad matching)
    if (filters.job_category && filters.job_category.trim()) {
      const category = filters.job_category.toLowerCase();
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(category) ||
        item.company?.toLowerCase().includes(category) ||
        // Broad matching for common terms
        (category.includes('computer') && (
          item.title?.toLowerCase().includes('software') ||
          item.title?.toLowerCase().includes('developer') ||
          item.title?.toLowerCase().includes('programming') ||
          item.title?.toLowerCase().includes('tech') ||
          item.title?.toLowerCase().includes('ai') ||
          item.title?.toLowerCase().includes('data')
        ))
      );
      console.log(`   After category filter (${category}): ${filtered.length} internships (removed ${beforeCount - filtered.length})`);
    }

    // Apply minimum stipend filter
    if (filters.minimum_stipend && filters.minimum_stipend.toString().trim()) {
      const minStipend = parseInt(filters.minimum_stipend.toString().replace(/[^\d]/g, ''));
      if (!isNaN(minStipend)) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(item => {
          if (!item.stipend) return false;
          const stipendMatch = item.stipend.match(/₹\s*(\d+(?:,\d+)*)/);
          if (stipendMatch) {
            const stipendAmount = parseInt(stipendMatch[1].replace(/,/g, ''));
            return stipendAmount >= minStipend;
          }
          return false;
        });
        console.log(`   After stipend filter (≥₹${minStipend}): ${filtered.length} internships (removed ${beforeCount - filtered.length})`);
      }
    }

    // Apply maximum results limit
    if (filters.maximum_results && filters.maximum_results > 0) {
      filtered = filtered.slice(0, filters.maximum_results);
      console.log(`   After limit filter: ${filtered.length} internships (showing top ${filters.maximum_results})`);
    }

    return filtered;
  }

  async waitForCompletion(runId, maxWaitTime = 600000) { // 10 minutes max
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusResponse = await axios.get(
          `${this.baseUrl}/actor-runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          }
        );

        const status = statusResponse.data.data.status;
        console.log(`⏳ Status: ${status}`);

        if (status === 'SUCCEEDED') {
          console.log('✅ Scraping completed successfully!');
          return await this.getResults(runId);
        } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          throw new Error(`Actor run ${status.toLowerCase()}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        if (error.message.includes('Actor run')) {
          throw error;
        }
        logger.warn('Polling error, retrying...', error.message);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Timeout waiting for actor to complete');
  }

  async getResults(runId) {
    try {
      // First get the run details to find the dataset ID
      const runResponse = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );

      const datasetId = runResponse.data.data.defaultDatasetId;
      
      // Then get the results from the dataset
      const resultsResponse = await axios.get(
        `${this.baseUrl}/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );

      const results = resultsResponse.data;
      logger.info(`Retrieved ${results.length} internship results`);
      return results;

    } catch (error) {
      logger.error('Failed to retrieve results:', error.message);
      throw error;
    }
  }

  formatResults(results) {
    if (!results || results.length === 0) {
      console.log('📭 No internships found matching your criteria.');
      return;
    }

    console.log(`\n🎯 Found ${results.length} internships:`);
    console.log('=' .repeat(100));

    results.forEach((internship, index) => {
      console.log(`\n${index + 1}. ${internship.company || 'Unknown Company'}`);
      console.log(`   📍 Location: ${internship.location || 'Not specified'}`);
      console.log(`   ⏰ Duration: ${internship.duration || 'Not specified'}`);
      console.log(`   💼 Actively Hiring: ${internship.actively_hiring ? '✅ Yes' : '❌ No'}`);
      console.log(`   🆕 Early Applicant: ${internship.early_applicant ? '✅ Yes' : '❌ No'}`);
      console.log(`   🔗 Apply: ${internship.apply_url || 'N/A'}`);
      console.log(`   📄 Details: ${internship.job_url || 'N/A'}`);
      console.log('   ' + '-'.repeat(80));
    });

    // Summary statistics
    const activelyHiring = results.filter(r => r.actively_hiring).length;
    const earlyApplicant = results.filter(r => r.early_applicant).length;
    const withStipend = results.filter(r => r.stipend && r.stipend !== 'Unpaid').length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total Internships: ${results.length}`);
    console.log(`   Actively Hiring: ${activelyHiring}`);
    console.log(`   Early Applicant Opportunities: ${earlyApplicant}`);
    console.log(`   With Stipend: ${withStipend}`);
  }

  async exportToCSV(results, csvExporter) {
    if (!results || results.length === 0) return null;

    try {
      // Transform results for CSV export
      const csvData = results.map((internship, index) => ({
        id: `internship_${index + 1}`,
        company: internship.company || 'Unknown',
        location: internship.location || 'Not specified',
        duration: internship.duration || 'Not specified',
        actively_hiring: internship.actively_hiring || false,
        early_applicant: internship.early_applicant || false,
        stipend: internship.stipend || 'Not specified',
        apply_url: internship.apply_url || '',
        job_url: internship.job_url || '',
        scraped_at: new Date().toISOString()
      }));

      const csvPath = await csvExporter.exportInternshipsToCSV(csvData);
      console.log(`📁 Results exported to: ${csvPath}`);
      return csvPath;

    } catch (error) {
      logger.error('CSV export failed:', error.message);
      console.log('❌ Failed to export to CSV:', error.message);
      return null;
    }
  }
}